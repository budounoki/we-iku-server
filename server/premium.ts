/**
 * プレミアムプラン（家族単位サブスクリプション）のサーバー側基盤。
 *
 * - 検証はすべてサーバー側で行う（クライアント申告のプラン状態を信用しない）。
 *   iOS:  StoreKit 2 の署名付きトランザクション（JWS）を Apple のルート証明書まで
 *         チェーン検証する。App Store Server API キーが設定されていれば
 *         更新状態の再確認にも使う。
 *   Android: Play Developer API purchases.subscriptionsv2 をサービスアカウントで照会。
 * - premium は家族単位：どちらかの親の購入で family_plans の 1 行が家族全体に効く。
 * - price_tier='free_forever'（モニター家族）は常にプレミアム相当。購入対象外。
 * - 解約（自動更新オフ）・失効を検出したら、購入者以外の家族メンバーへ通知する
 *   （クライアント要件 2026-09）。
 */
import type { Express, Request } from "express";
import { createPrivateKey, createSign, verify as cryptoVerify, X509Certificate } from "crypto";
import fs from "fs";
import { z } from "zod";
import { db } from "./db";
import { familyPlans, users } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { storage } from "./storage";
import { sendFamilyPush } from "./push";

export const PREMIUM_PRODUCT_IDS = new Set(["premium_monthly_500", "premium_yearly_5000"]);

const IOS_BUNDLE_ID = process.env.PREMIUM_IOS_BUNDLE_ID || "com.weyuapp3.app";
const ANDROID_PACKAGE = process.env.PREMIUM_ANDROID_PACKAGE || "com.weyuapp.app";

// Apple Root CA - G3 の SHA-256 フィンガープリント（JWS 証明書チェーンのピン止め）。
const APPLE_ROOT_CA_G3_FINGERPRINT256 = (
  process.env.APPLE_ROOT_CA_G3_FINGERPRINT
  || "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79"
).toUpperCase();

type SubscriptionStatus = "active" | "grace" | "canceled" | "expired";

interface VerifiedSubscription {
  productId: string;
  status: SubscriptionStatus;
  expiresAt: Date;
  originalTransactionId: string;
  environment?: string;
}

// ─── iOS: StoreKit 2 JWS 検証 ────────────────────────────────────────────────

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyAppleJws(jws: string): Record<string, any> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("invalid JWS format");
  const header = JSON.parse(b64urlToBuf(parts[0]).toString("utf8"));
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new Error("unexpected JWS header");
  }
  const chain = header.x5c.map(
    (der: string) => new X509Certificate(Buffer.from(der, "base64")),
  );
  // リーフ→中間→ルートの署名チェーンを検証し、ルートを Apple Root CA - G3 に固定する。
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i].verify(chain[i + 1].publicKey)) {
      throw new Error("JWS certificate chain verification failed");
    }
  }
  const root = chain[chain.length - 1];
  if (root.fingerprint256.toUpperCase() !== APPLE_ROOT_CA_G3_FINGERPRINT256) {
    throw new Error("JWS root certificate is not Apple Root CA - G3");
  }
  const now = new Date();
  const leaf = chain[0];
  if (now < new Date(leaf.validFrom) || now > new Date(leaf.validTo)) {
    throw new Error("JWS leaf certificate is not currently valid");
  }
  // JOSE の ES256 署名は IEEE P1363 形式。
  const ok = cryptoVerify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
    b64urlToBuf(parts[2]),
  );
  if (!ok) throw new Error("JWS signature verification failed");
  return JSON.parse(b64urlToBuf(parts[1]).toString("utf8"));
}

function verifyIosTransaction(jws: string): VerifiedSubscription {
  const p = verifyAppleJws(jws);
  if (p.bundleId !== IOS_BUNDLE_ID) throw new Error(`bundleId mismatch: ${p.bundleId}`);
  if (!PREMIUM_PRODUCT_IDS.has(p.productId)) throw new Error(`unknown productId: ${p.productId}`);
  if (p.type && p.type !== "Auto-Renewable Subscription") {
    throw new Error(`unexpected transaction type: ${p.type}`);
  }
  if (p.revocationDate) throw new Error("transaction has been revoked");
  const expiresAt = new Date(Number(p.expiresDate));
  if (!Number.isFinite(expiresAt.getTime())) throw new Error("missing expiresDate");
  return {
    productId: p.productId,
    // 単発の JWS からは自動更新の有無まで分からないので active/expired のみ。
    // 解約検出は cron の App Store Server API 照会（設定時）または失効で拾う。
    status: expiresAt.getTime() > Date.now() ? "active" : "expired",
    expiresAt,
    originalTransactionId: String(p.originalTransactionId),
    environment: p.environment,
  };
}

// ─── iOS: App Store Server API（キー設定時のみ・cron の再検証に使用） ──────────

function appStoreServerApiConfigured(): boolean {
  return Boolean(
    process.env.APPSTORE_ISSUER_ID
    && process.env.APPSTORE_KEY_ID
    && (process.env.APPSTORE_PRIVATE_KEY || process.env.APPSTORE_PRIVATE_KEY_PATH),
  );
}

function appStoreServerJwt(): string {
  const keyPem = process.env.APPSTORE_PRIVATE_KEY
    || fs.readFileSync(process.env.APPSTORE_PRIVATE_KEY_PATH!, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: process.env.APPSTORE_KEY_ID, typ: "JWT" };
  const payload = {
    iss: process.env.APPSTORE_ISSUER_ID,
    iat: now,
    exp: now + 300,
    aud: "appstoreconnect-v1",
    bid: IOS_BUNDLE_ID,
  };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const sign = createSign("sha256");
  sign.update(signingInput);
  const signature = sign.sign(
    { key: createPrivateKey(keyPem), dsaEncoding: "ieee-p1363" },
  ).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function fetchIosSubscriptionStatus(
  originalTransactionId: string,
  environment?: string | null,
): Promise<VerifiedSubscription | null> {
  if (!appStoreServerApiConfigured()) return null;
  const host = environment === "Sandbox"
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com";
  const res = await fetch(`${host}/inApps/v1/subscriptions/${originalTransactionId}`, {
    headers: { Authorization: `Bearer ${appStoreServerJwt()}` },
  });
  if (!res.ok) {
    console.error(`App Store Server API error ${res.status} for ${originalTransactionId}`);
    return null;
  }
  const body = await res.json();
  const last = body?.data?.[0]?.lastTransactions?.[0];
  if (!last?.signedTransactionInfo) return null;
  const tx = verifyAppleJws(last.signedTransactionInfo);
  const renewal = last.signedRenewalInfo ? verifyAppleJws(last.signedRenewalInfo) : null;
  const expiresAt = new Date(Number(tx.expiresDate));
  // status: 1=active 2=expired 3=billing retry 4=grace period 5=revoked
  let status: SubscriptionStatus;
  switch (last.status) {
    case 1: status = renewal && renewal.autoRenewStatus === 0 ? "canceled" : "active"; break;
    case 4: status = "grace"; break;
    case 3: status = expiresAt.getTime() > Date.now() ? "grace" : "expired"; break;
    default: status = "expired";
  }
  return {
    productId: tx.productId,
    status,
    expiresAt,
    originalTransactionId: String(tx.originalTransactionId),
    environment: tx.environment,
  };
}

// ─── Android: Play Developer API ────────────────────────────────────────────

interface PlayServiceAccount { client_email: string; private_key: string; token_uri: string }

function loadPlayServiceAccount(): PlayServiceAccount | null {
  try {
    const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON
      || (process.env.PLAY_SERVICE_ACCOUNT_JSON_PATH
        ? fs.readFileSync(process.env.PLAY_SERVICE_ACCOUNT_JSON_PATH, "utf8")
        : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

let playToken: { token: string; expiresAt: number } | null = null;

async function playAccessToken(sa: PlayServiceAccount): Promise<string> {
  if (playToken && playToken.expiresAt > Date.now() + 60_000) return playToken.token;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const signingInput = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const assertion = `${signingInput}.${sign.sign(sa.private_key).toString("base64url")}`;
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Play OAuth token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  playToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return playToken.token;
}

async function verifyAndroidPurchase(purchaseToken: string): Promise<VerifiedSubscription> {
  const sa = loadPlayServiceAccount();
  if (!sa) throw Object.assign(new Error("play-not-configured"), { code: "NOT_CONFIGURED" });
  const token = await playAccessToken(sa);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Play API error ${res.status}: ${await res.text()}`);
  const sub = await res.json();
  const line = sub.lineItems?.[0];
  if (!line?.productId || !PREMIUM_PRODUCT_IDS.has(line.productId)) {
    throw new Error(`unknown productId: ${line?.productId}`);
  }
  const expiresAt = new Date(line.expiryTime);
  let status: SubscriptionStatus;
  switch (sub.subscriptionState) {
    case "SUBSCRIPTION_STATE_ACTIVE": status = "active"; break;
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": status = "grace"; break;
    case "SUBSCRIPTION_STATE_CANCELED":
      status = expiresAt.getTime() > Date.now() ? "canceled" : "expired"; break;
    default: status = "expired";
  }
  return {
    productId: line.productId,
    status,
    expiresAt,
    originalTransactionId: sub.latestOrderId || purchaseToken.slice(0, 64),
  };
}

// ─── プラン状態の適用と通知 ──────────────────────────────────────────────────

export interface EffectivePlan {
  tier: "free" | "premium" | "free_forever";
  productId?: string | null;
  platform?: string | null;
  status?: string | null;
  expiresAt?: Date | null;
  purchasedByUserId?: number | null;
}

// canceled は「自動更新オフ」で、期限まではプレミアムのまま。
const PREMIUM_STATUSES: SubscriptionStatus[] = ["active", "grace", "canceled"];

export async function getEffectivePlan(familyId: string): Promise<EffectivePlan> {
  const [row] = await db.select().from(familyPlans)
    .where(eq(familyPlans.familyId, familyId)).limit(1);
  if (!row) return { tier: "free" };
  if (row.priceTier === "free_forever") return { tier: "free_forever" };
  const premium = row.subscriptionStatus
    && PREMIUM_STATUSES.includes(row.subscriptionStatus as SubscriptionStatus)
    && row.expiresAt && new Date(row.expiresAt).getTime() > Date.now();
  return {
    tier: premium ? "premium" : "free",
    productId: row.subscriptionProductId,
    platform: row.platform,
    status: row.subscriptionStatus,
    expiresAt: row.expiresAt,
    purchasedByUserId: row.purchasedByUserId,
  };
}

async function notifyPartnerOfCancellation(
  familyId: string,
  purchasedByUserId: number | null,
  newStatus: SubscriptionStatus,
  expiresAt: Date,
) {
  const dateStr = `${expiresAt.getMonth() + 1}月${expiresAt.getDate()}日`;
  const message = newStatus === "expired"
    ? "プレミアムプランが終了しました。広告が再び表示されます。"
    : `プレミアムプランが解約されました（${dateStr}まで利用可能です）。`;
  try {
    // 購入者の role を調べ、パートナー側の通知欄に出す。不明なら両方に出す。
    let targets: string[] = ["papa", "mama"];
    if (purchasedByUserId) {
      const [purchaser] = await db.select({ role: users.role }).from(users)
        .where(eq(users.id, purchasedByUserId)).limit(1);
      if (purchaser?.role === "papa") targets = ["mama"];
      else if (purchaser?.role === "mama") targets = ["papa"];
    }
    for (const targetUser of targets) {
      await storage.createNotification({ familyId, targetUser, message, type: "premium" });
    }
    await sendFamilyPush(db as any, familyId, purchasedByUserId, "We育", message);
  } catch (err) {
    console.error("premium cancellation notification error:", err);
  }
}

async function applyVerifiedState(
  familyId: string,
  platform: "ios" | "android",
  verified: VerifiedSubscription,
  opts: { purchasedByUserId?: number | null; purchaseToken?: string | null },
): Promise<EffectivePlan> {
  const [prev] = await db.select().from(familyPlans)
    .where(eq(familyPlans.familyId, familyId)).limit(1);

  const values = {
    familyId,
    subscriptionProductId: verified.productId,
    platform,
    originalTransactionId: verified.originalTransactionId,
    ...(opts.purchaseToken ? { purchaseToken: opts.purchaseToken } : {}),
    ...(opts.purchasedByUserId ? { purchasedByUserId: opts.purchasedByUserId } : {}),
    subscriptionStatus: verified.status,
    expiresAt: verified.expiresAt,
    updatedAt: new Date(),
  };
  await db.insert(familyPlans).values(values).onConflictDoUpdate({
    target: familyPlans.familyId,
    set: values,
  });

  // active → canceled/expired の遷移でパートナーへ通知（要件：解約時の通知）。
  const prevStatus = prev?.subscriptionStatus as SubscriptionStatus | undefined;
  if (
    prevStatus && ["active", "grace"].includes(prevStatus)
    && ["canceled", "expired"].includes(verified.status)
  ) {
    await notifyPartnerOfCancellation(
      familyId,
      opts.purchasedByUserId ?? prev?.purchasedByUserId ?? null,
      verified.status,
      verified.expiresAt,
    );
  }
  return getEffectivePlan(familyId);
}

// ─── ルート ──────────────────────────────────────────────────────────────────

function sessionUserId(req: Request): number | null {
  const v = (req.session as any)?.userId;
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null;
}

export function registerPremiumRoutes(app: Express) {
  app.get("/api/families/:familyId/plan", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      res.json(await getEffectivePlan(req.params.familyId));
    } catch (err) {
      console.error("plan fetch error:", err);
      res.status(500).json({ message: "プラン状態の取得に失敗しました" });
    }
  });

  // 購入・復元の両方がこのエンドポイントを使う（どちらも「今の証明を検証して反映」）。
  app.post("/api/premium/verify", async (req, res) => {
    try {
      const input = z.object({
        familyId: z.string().trim().min(1).max(64),
        platform: z.enum(["ios", "android"]),
        jws: z.string().min(1).optional(),          // iOS: signed transaction
        purchaseToken: z.string().min(1).optional(), // Android
      }).parse(req.body);

      let verified: VerifiedSubscription;
      if (input.platform === "ios") {
        if (!input.jws) return res.status(400).json({ message: "jws is required for ios" });
        verified = verifyIosTransaction(input.jws);
      } else {
        if (!input.purchaseToken) {
          return res.status(400).json({ message: "purchaseToken is required for android" });
        }
        verified = await verifyAndroidPurchase(input.purchaseToken);
      }

      const plan = await applyVerifiedState(input.familyId, input.platform, verified, {
        purchasedByUserId: sessionUserId(req),
        purchaseToken: input.purchaseToken ?? null,
      });
      res.json(plan);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err?.code === "NOT_CONFIGURED") {
        return res.status(503).json({ message: "購入検証の設定が未完了です。時間をおいてお試しください。" });
      }
      console.error("premium verify error:", err);
      res.status(400).json({ message: "購入の検証に失敗しました" });
    }
  });
}

// ─── 定期再検証（更新・解約・失効の自動反映） ────────────────────────────────

export async function revalidateSubscriptions(): Promise<void> {
  const rows = await db.select().from(familyPlans)
    .where(inArray(familyPlans.subscriptionStatus, ["active", "grace", "canceled"]));
  for (const row of rows) {
    try {
      if (row.platform === "android" && row.purchaseToken) {
        const verified = await verifyAndroidPurchase(row.purchaseToken);
        await applyVerifiedState(row.familyId, "android", verified, {
          purchasedByUserId: row.purchasedByUserId,
          purchaseToken: row.purchaseToken,
        });
      } else if (row.platform === "ios" && row.originalTransactionId) {
        const verified = await fetchIosSubscriptionStatus(row.originalTransactionId);
        if (verified) {
          await applyVerifiedState(row.familyId, "ios", verified, {
            purchasedByUserId: row.purchasedByUserId,
          });
        } else if (row.expiresAt
          && new Date(row.expiresAt).getTime() + 3 * 86_400_000 < Date.now()) {
          // App Store Server API 未設定時のフォールバック：
          // 期限から3日（猶予）過ぎても新しい証明が来なければ失効扱い。
          // （アプリは起動時に現在のエンタイトルメントを /verify に送り直すので、
          //   更新が続いていれば expiresAt は自動的に先へ延びる。）
          await applyVerifiedState(row.familyId, "ios", {
            productId: row.subscriptionProductId || "premium_monthly_500",
            status: "expired",
            expiresAt: new Date(row.expiresAt),
            originalTransactionId: row.originalTransactionId,
          }, { purchasedByUserId: row.purchasedByUserId });
        }
      }
    } catch (err) {
      console.error(`premium revalidation error (family ${row.familyId}):`, err);
    }
  }
}

export function startPremiumRevalidationCron(): void {
  const INTERVAL_MS = 12 * 60 * 60 * 1000;
  setInterval(() => {
    revalidateSubscriptions().catch((err) =>
      console.error("premium revalidation cron error:", err));
  }, INTERVAL_MS).unref();
  // 起動直後にも一度実行（サーバー停止中に失効したものを拾う）。
  setTimeout(() => {
    revalidateSubscriptions().catch((err) =>
      console.error("premium initial revalidation error:", err));
  }, 30_000).unref();
}
