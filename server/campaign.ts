/**
 * キャンペーン（簡易版）— ぶどうの木宿泊券プレゼント 2026。
 *
 * 応募そのものはクライアントが用意する Google フォームで受け付ける。アプリは
 * ホームにバナーを出し、タップで「ユーザーごとの識別コード付き」のフォームを
 * アプリ内ブラウザで開くだけ。サーバーはここで
 *   - バナーを出してよいか（期間・登録日・ロール）の判定
 *   - 推測できない識別コードの発行（1ユーザー1コード固定）
 * を行う。締め切り後は、フォームに集まったコードを scripts/campaign-extract.mjs で
 * 登録日時・ログイン方法・ロールに突き合わせる。
 *
 * 判定はすべてサーバー時刻（JST 基準の固定日時）で行い、端末の時刻は使わない。
 */
import type { Express, Request, Response } from "express";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { users } from "@shared/schema";

export const CAMPAIGN = {
  slug: "budounoki-stay-2026",
  /** 応募期間（JST）。endsAt は排他的＝11/30 23:59:59 まで。 */
  startsAt: new Date("2026-11-01T00:00:00+09:00"),
  endsAt: new Date("2026-12-01T00:00:00+09:00"),
  bannerTitle: "🍇 ぶどうの木の宿泊券が10名様に当たる！",
  bannerSubtitle: "期間中に新しくWe育を始めた方が対象（11/1〜11/30）",
  /**
   * クライアントの Google フォームの「事前入力URL」。末尾に識別コードを付けて開く。
   * 例: https://docs.google.com/forms/d/e/XXXX/viewform?usp=pp_url&entry.123456=
   * 空のうちはバナーを出さない（プレビュー対象ユーザーを除く）。
   */
  formUrlPrefix: "https://docs.google.com/forms/d/e/1FAIpQLScOYFIff0f5nEB25rWuC3b_jqOCSDPyvNkKRHB47gqjzL-2ZA/viewform?usp=pp_url&entry.1668652578=",
  /**
   * 期間前・登録日に関係なくバナーを出す確認用ユーザーID（本番の動作確認用）。
   * 公開前に空に戻すこと。
   */
  previewUserIds: [] as number[],
};

/** 識別コードの文字。読み間違いやすい O・0・I・1・L を除いた英大文字＋数字（31種）。 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_codes (
      campaign   TEXT NOT NULL,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (campaign, user_id)
    )
  `);
}

/** そのユーザーの識別コードを返す（無ければ発行）。同じユーザーには常に同じコード。 */
async function codeFor(userId: number): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await pool.query(
      "SELECT code FROM campaign_codes WHERE campaign = $1 AND user_id = $2",
      [CAMPAIGN.slug, userId],
    );
    if (existing.rows[0]?.code) return existing.rows[0].code;
    try {
      await pool.query(
        "INSERT INTO campaign_codes (campaign, user_id, code) VALUES ($1, $2, $3) ON CONFLICT (campaign, user_id) DO NOTHING",
        [CAMPAIGN.slug, userId, generateCode()],
      );
    } catch (error: any) {
      // 別ユーザーとコードが衝突した（31^10 通りなので実質起きない）→ 作り直す。
      if (error?.code !== "23505") throw error;
    }
  }
  throw new Error("campaign code generation failed");
}

function sessionUserId(req: Request): number | null {
  const raw = (req.session as any)?.userId;
  const id = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function registerCampaignRoutes(app: Express) {
  ensureTable().catch((error) => console.error("[campaign] table setup failed", error));

  app.get("/api/campaign/current", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    const hidden = { show: false as const };
    try {
      const userId = sessionUserId(req);
      if (!userId) return res.json(hidden);
      const preview = CAMPAIGN.previewUserIds.includes(userId);

      const now = Date.now();
      const inPeriod = now >= CAMPAIGN.startsAt.getTime() && now < CAMPAIGN.endsAt.getTime();
      if (!inPeriod && !preview) return res.json(hidden);
      if (!CAMPAIGN.formUrlPrefix && !preview) return res.json(hidden);

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.json(hidden);
      // 期間中に新しく始めた方のみ（10/29 以前の登録は対象外）。
      const registeredAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
      if (registeredAt < CAMPAIGN.startsAt.getTime() && !preview) return res.json(hidden);
      // ママ・パパのみ。施設などサポーターとして連携されたアカウントは対象外。
      if (user.role !== "papa" && user.role !== "mama") return res.json(hidden);
      const supporter = await pool.query(
        "SELECT 1 FROM supporter_accounts WHERE user_id = $1 AND is_active = true LIMIT 1",
        [userId],
      );
      if (supporter.rowCount) return res.json(hidden);

      const code = await codeFor(userId);
      res.json({
        show: true,
        title: CAMPAIGN.bannerTitle,
        subtitle: CAMPAIGN.bannerSubtitle,
        code,
        url: CAMPAIGN.formUrlPrefix ? CAMPAIGN.formUrlPrefix + encodeURIComponent(code) : null,
        endsAt: CAMPAIGN.endsAt.toISOString(),
      });
    } catch (error) {
      // キャンペーンの不具合でホームを壊さない。バナーを出さないだけにする。
      console.error("[campaign] current failed", error);
      res.json(hidden);
    }
  });
}
