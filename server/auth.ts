import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { users, invitationCodes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { pool } from "./db";

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID!;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const APPLE_EXPECTED_AUDIENCE = process.env.APPLE_BUNDLE_ID || process.env.APPLE_SERVICE_ID || "";

// ─── Mobile token store ──────────────────────────────────────────────────────
// Maps a random token → user data for mobile clients that can't use cookies.
interface MobileUserData {
  userId: number;
  familyId: string;
  role: string;
  displayName: string;
  pictureUrl: string;
  invitationVerified: boolean;
}

export const mobileTokenStore = new Map<string, MobileUserData>();

function generateMobileToken(): string {
  return `mt_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
}

// Middleware: inject token data into req.session so all existing route handlers work unchanged.
export function mobileAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const data = mobileTokenStore.get(token);
    if (data) {
      const s = req.session as any;
      s.userId = data.userId;
      s.familyId = data.familyId;
      s.role = data.role;
      s.displayName = data.displayName;
      s.pictureUrl = data.pictureUrl;
      s.invitationVerified = data.invitationVerified;
      // Prevent this ephemeral data from being persisted to the session table.
      req.session.save = ((cb?: (err?: any) => void) => {
        if (cb) cb(null);
        return req.session;
      }) as any;
    }
  }
  next();
}

function getBaseUrl(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const forwardedHost = req.headers["x-forwarded-host"];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
    req.headers.host ||
    "localhost:5000";
  // LINE Login (and most OAuth providers) require https for non-localhost
  // callback URLs, so always emit https unless we're talking to localhost.
  const isLocalhost = /^localhost(:|$)|^127\.0\.0\.1(:|$)/.test(host);
  const proto = isLocalhost ? "http" : "https";
  return `${proto}://${host}`;
}

// Helper: upsert user and return a mobile token + user record.
async function upsertUserAndGetToken(
  providerUserId: string,
  displayName: string,
  pictureUrl: string | null,
): Promise<{ token: string; user: typeof users.$inferSelect }> {
  let [user] = await db.select().from(users).where(eq(users.lineUserId, providerUserId));

  if (!user) {
    const familyId = `family-${Math.random().toString(36).substring(2, 10)}`;
    [user] = await db
      .insert(users)
      .values({ lineUserId: providerUserId, displayName, pictureUrl, familyId, role: "papa" })
      .returning();
  } else {
    await db.update(users).set({ displayName, pictureUrl }).where(eq(users.id, user.id));
    user = { ...user, displayName, pictureUrl };
  }

  const token = generateMobileToken();
  mobileTokenStore.set(token, {
    userId: user.id,
    familyId: user.familyId!,
    role: user.role ?? "papa",
    displayName: user.displayName ?? displayName,
    pictureUrl: user.pictureUrl ?? pictureUrl ?? "",
    invitationVerified: user.invitationVerified ?? false,
  });

  return { token, user };
}

export async function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);

  // Additive column migrations — safe to run on every startup.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
    ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS family_id TEXT;
  `);

  app.use(
    session({
      store: new PgStore({
        pool: pool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET || "we-iku-session-secret",
      resave: true,
      saveUninitialized: true,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    }),
  );

  // Mobile token middleware runs after session so it can override.
  app.use(mobileAuthMiddleware);

  // ─── LINE Login ────────────────────────────────────────────────────────────
  app.get("/api/auth/line", (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/auth/line/callback`;
    const state = Math.random().toString(36).substring(2);
    const isMobile = req.query.mobile === "true";

    (req.session as any).lineState = state;
    (req.session as any).isMobileLogin = isMobile;

    const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", LINE_CHANNEL_ID);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "profile openid");

    res.redirect(authUrl.toString());
  });

  app.get("/api/auth/line/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      const savedState = (req.session as any).lineState;
      const isMobile = (req.session as any).isMobileLogin;

      if (!code || state !== savedState) {
        return res.redirect("/?auth_error=invalid_state");
      }

      const baseUrl = getBaseUrl(req);
      const callbackUrl = `${baseUrl}/api/auth/line/callback`;

      const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: callbackUrl,
          client_id: LINE_CHANNEL_ID,
          client_secret: LINE_CHANNEL_SECRET,
        }),
      });

      if (!tokenRes.ok) {
        console.error("LINE token error:", await tokenRes.text());
        return res.redirect("/?auth_error=token_failed");
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const profileRes = await fetch("https://api.line.me/v2/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) {
        console.error("LINE profile error:", await profileRes.text());
        return res.redirect("/?auth_error=profile_failed");
      }

      const profile = await profileRes.json();
      const lineUserId = profile.userId;
      const displayName = profile.displayName;
      const pictureUrl = profile.pictureUrl || null;

      let [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.lineUserId, lineUserId));

      if (!existingUser) {
        const familyId = `family-${Math.random().toString(36).substring(2, 10)}`;
        [existingUser] = await db
          .insert(users)
          .values({ lineUserId, displayName, pictureUrl, familyId, role: "papa" })
          .returning();
      } else {
        await db
          .update(users)
          .set({ displayName, pictureUrl })
          .where(eq(users.lineUserId, lineUserId));
      }

      // ── Mobile: redirect via deep link with token ──
      if (isMobile) {
        const mobileToken = generateMobileToken();
        mobileTokenStore.set(mobileToken, {
          userId: existingUser.id,
          familyId: existingUser.familyId!,
          role: existingUser.role ?? "papa",
          displayName,
          pictureUrl: pictureUrl ?? "",
          invitationVerified: existingUser.invitationVerified ?? false,
        });

        const deepLink =
          `weyu://auth/callback` +
          `?token=${encodeURIComponent(mobileToken)}` +
          `&userId=${existingUser.id}` +
          `&familyId=${encodeURIComponent(existingUser.familyId!)}` +
          `&role=${encodeURIComponent(existingUser.role ?? "papa")}` +
          `&displayName=${encodeURIComponent(displayName)}` +
          `&pictureUrl=${encodeURIComponent(pictureUrl ?? "")}` +
          `&invitationVerified=${existingUser.invitationVerified ?? false}`;

        return res.redirect(deepLink);
      }

      // ── Web: session-based flow ──
      (req.session as any).userId = existingUser.id;
      (req.session as any).lineUserId = lineUserId;
      (req.session as any).familyId = existingUser.familyId;
      (req.session as any).role = existingUser.role;
      (req.session as any).displayName = displayName;
      (req.session as any).pictureUrl = pictureUrl;
      (req.session as any).invitationVerified = existingUser.invitationVerified;

      const authData = {
        login_success: true,
        familyId: existingUser.familyId,
        role: existingUser.role,
        displayName,
        pictureUrl: pictureUrl || "",
        invitationVerified: existingUser.invitationVerified,
      };

      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ログイン完了</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;background:linear-gradient(135deg,#f3e8ff,#fff,#ecfdf5);min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{text-align:center;padding:40px 24px;max-width:360px;width:90%}
  .icon{width:80px;height:80px;border-radius:50%;background:#f3e8ff;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
  .icon svg{width:40px;height:40px;color:#805AAA}
  h1{font-size:22px;font-weight:900;color:#805AAA;margin-bottom:8px}
  .sub{font-size:14px;color:#6b7280;margin-bottom:24px}
  .name{font-size:16px;font-weight:700;color:#374151;margin-bottom:24px}
  .btn{display:block;width:100%;padding:16px;border-radius:16px;background:#805AAA;color:#fff;font-size:16px;font-weight:900;text-decoration:none;border:none;cursor:pointer;margin-bottom:12px}
  .hint{font-size:12px;color:#9ca3af;line-height:1.6}
</style></head><body>
<div class="card">
  <div class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
  <h1>ログイン完了</h1>
  <p class="name">${displayName}さん、ようこそ！</p>
  <a href="/" class="btn" id="openApp">アプリを開く</a>
  <p class="hint">ホーム画面にアプリを追加している場合は、<br>ホーム画面のアイコンからお開きください</p>
</div>
<script>
  var data = ${JSON.stringify(authData)};
  localStorage.setItem('familyId', data.familyId);
  localStorage.setItem('userType', data.role);
  localStorage.setItem('lineDisplayName', data.displayName);
  localStorage.setItem('linePictureUrl', data.pictureUrl);
  localStorage.setItem('onboarding_done', 'true');
  if (data.invitationVerified) localStorage.setItem('invitation_verified', 'true');
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) { window.location.href = '/'; }
</script>
</body></html>`);
    } catch (error) {
      console.error("LINE auth error:", error);
      res.redirect("/?auth_error=server_error");
    }
  });

  // ─── Google Login (server-side redirect flow for native apps) ──────────────
  // Works like LINE login: server handles the OAuth redirect so the native app
  // doesn't need to register custom redirect URIs with Google.
  const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID
    || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    || "";
  const GOOGLE_WEB_CLIENT_SECRET = process.env.GOOGLE_WEB_CLIENT_SECRET || "";

  app.get("/api/auth/google/native", (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/auth/google/callback`;
    const state = Math.random().toString(36).substring(2);

    (req.session as any).googleState = state;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_WEB_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "profile email");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "select_account");

    res.redirect(authUrl.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      const savedState = (req.session as any).googleState;

      if (!code || state !== savedState) {
        return res.redirect("/?auth_error=invalid_state");
      }

      const baseUrl = getBaseUrl(req);
      const callbackUrl = `${baseUrl}/api/auth/google/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: GOOGLE_WEB_CLIENT_ID,
          client_secret: GOOGLE_WEB_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        console.error("Google token error:", await tokenRes.text());
        return res.redirect("/?auth_error=token_failed");
      }

      const { access_token } = await tokenRes.json();

      // Get user profile
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!profileRes.ok) {
        console.error("Google profile error:", await profileRes.text());
        return res.redirect("/?auth_error=profile_failed");
      }

      const profile = await profileRes.json();
      const { token: mobileToken, user: existingUser } = await upsertUserAndGetToken(
        `google_${profile.sub}`,
        profile.name ?? profile.email ?? "Googleユーザー",
        profile.picture ?? null,
      );

      const deepLink =
        `weyu://auth/callback` +
        `?token=${encodeURIComponent(mobileToken)}` +
        `&userId=${existingUser.id}` +
        `&familyId=${encodeURIComponent(existingUser.familyId!)}` +
        `&role=${encodeURIComponent(existingUser.role ?? "papa")}` +
        `&displayName=${encodeURIComponent(existingUser.displayName ?? "")}` +
        `&pictureUrl=${encodeURIComponent(existingUser.pictureUrl ?? "")}` +
        `&invitationVerified=${existingUser.invitationVerified ?? false}`;

      res.redirect(deepLink);
    } catch (error) {
      console.error("Google auth error:", error);
      res.redirect("/?auth_error=server_error");
    }
  });

  // ─── Google Login (mobile) ─────────────────────────────────────────────────
  // The mobile app exchanges a Google accessToken for a mobile session token.
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { accessToken, idToken } = req.body as { accessToken?: string; idToken?: string };
      if (!accessToken && !idToken) {
        return res.status(400).json({ message: "accessToken or idToken is required" });
      }

      let profile: any;
      if (accessToken) {
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!profileRes.ok) {
          return res.status(401).json({ message: "Invalid Google access token" });
        }
        profile = await profileRes.json();
      } else {
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken!)}`,
        );
        if (!tokenInfoRes.ok) {
          return res.status(401).json({ message: "Invalid Google id token" });
        }
        const info = await tokenInfoRes.json();
        profile = {
          sub: info.sub,
          email: info.email,
          name: info.name,
          picture: info.picture,
        };
      }
      const { token, user } = await upsertUserAndGetToken(
        `google_${profile.sub}`,
        profile.name ?? profile.email ?? "Googleユーザー",
        profile.picture ?? null,
      );

      res.json({
        token,
        user: {
          id: user.id,
          familyId: user.familyId,
          role: user.role,
          displayName: user.displayName,
          pictureUrl: user.pictureUrl,
          invitationVerified: user.invitationVerified,
        },
      });
    } catch (err) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google login failed" });
    }
  });

  // ─── Apple Login (mobile) ──────────────────────────────────────────────────
  // The mobile app sends the Apple identityToken (JWT) and optional name.
  app.post("/api/auth/apple", async (req: Request, res: Response) => {
    try {
      const { identityToken, fullName, email } = req.body as {
        identityToken: string;
        fullName?: { givenName?: string; familyName?: string };
        email?: string;
      };

      if (!identityToken) {
        return res.status(400).json({ message: "identityToken is required" });
      }

      const parts = identityToken.split(".");
      if (parts.length !== 3) {
        return res.status(400).json({ message: "Invalid Apple identity token format" });
      }

      // Decode payload from base64url. Signature verification should be added for
      // production environments that require strict token trust.
      const payloadB64 = parts[1];
      const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const payload = JSON.parse(
        Buffer.from(padded, "base64").toString("utf8"),
      );
      if (payload.iss !== "https://appleid.apple.com") {
        return res.status(401).json({ message: "Invalid Apple token issuer" });
      }
      if (APPLE_EXPECTED_AUDIENCE && payload.aud !== APPLE_EXPECTED_AUDIENCE) {
        return res.status(401).json({ message: "Invalid Apple token audience" });
      }
      const appleId: string = payload.sub;

      const displayName =
        fullName?.givenName
          ? `${fullName.givenName}${fullName.familyName ? " " + fullName.familyName : ""}`
          : email ?? "Appleユーザー";

      const { token, user } = await upsertUserAndGetToken(
        `apple_${appleId}`,
        displayName,
        null,
      );

      res.json({
        token,
        user: {
          id: user.id,
          familyId: user.familyId,
          role: user.role,
          displayName: user.displayName,
          pictureUrl: user.pictureUrl,
          invitationVerified: user.invitationVerified,
        },
      });
    } catch (err) {
      console.error("Apple auth error:", err);
      res.status(500).json({ message: "Apple login failed" });
    }
  });

  // ─── Mobile logout ─────────────────────────────────────────────────────────
  app.post("/api/auth/mobile/logout", (req: Request, res: Response) => {
    const auth = req.headers["authorization"];
    if (auth && auth.startsWith("Bearer ")) {
      mobileTokenStore.delete(auth.slice(7));
    }
    res.json({ success: true });
  });

  // ─── Common endpoints ──────────────────────────────────────────────────────
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const s = req.session as any;
    if (s.userId) {
      let invitationVerified = s.invitationVerified ?? false;
      if (!invitationVerified) {
        const [user] = await db.select().from(users).where(eq(users.id, s.userId));
        if (user) {
          invitationVerified = user.invitationVerified;
          s.invitationVerified = invitationVerified;
        }
      }
      res.json({
        authenticated: true,
        userId: s.userId,
        lineUserId: s.lineUserId,
        familyId: s.familyId,
        role: s.role,
        displayName: s.displayName,
        pictureUrl: s.pictureUrl,
        invitationVerified,
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.post("/api/auth/verify-code", async (req: Request, res: Response) => {
    const s = req.session as any;
    if (!s.userId) {
      return res.status(401).json({ message: "ログインが必要です" });
    }

    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "招待コードを入力してください" });
    }

    const normalizedCode = code.trim().toUpperCase();
    const [invitation] = await db
      .select()
      .from(invitationCodes)
      .where(eq(invitationCodes.code, normalizedCode));

    if (!invitation) {
      return res.status(400).json({ message: "無効な招待コードです" });
    }
    if (invitation.isUsed) {
      return res.status(400).json({ message: "この招待コードは既に使用されています" });
    }

    await db
      .update(invitationCodes)
      .set({ isUsed: true, usedBy: s.lineUserId ?? `user_${s.userId}`, usedAt: new Date() })
      .where(eq(invitationCodes.id, invitation.id));

    // If the code carries a familyId, join the sender's family.
    const newFamilyId = (invitation as any).familyId ?? s.familyId;
    await db
      .update(users)
      .set({ invitationVerified: true, familyId: newFamilyId })
      .where(eq(users.id, s.userId));
    s.invitationVerified = true;
    s.familyId = newFamilyId;

    // Also update the mobile token store entry if present.
    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) {
      const entry = mobileTokenStore.get(auth.slice(7));
      if (entry) {
        entry.invitationVerified = true;
        entry.familyId = newFamilyId;
      }
    }

    res.json({ success: true, message: "招待コードが確認されました", familyId: newFamilyId });
  });

  // ─── Generate invitation code ──────────────────────────────────────────────
  app.post("/api/auth/generate-invite", async (req: Request, res: Response) => {
    const s = req.session as any;
    if (!s.userId) return res.status(401).json({ message: "ログインが必要です" });

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const [invitation] = await db
      .insert(invitationCodes)
      .values({ code, familyId: s.familyId } as any)
      .returning();

    res.json({ code: invitation.code });
  });

  // ─── Save Expo push token ──────────────────────────────────────────────────
  app.post("/api/auth/push-token", async (req: Request, res: Response) => {
    const s = req.session as any;
    if (!s.userId) return res.status(401).json({ message: "ログインが必要です" });

    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "token is required" });
    }

    await db.update(users).set({ pushToken: token } as any).where(eq(users.id, s.userId));

    // Also refresh the in-memory mobile token store entry.
    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) {
      const entry = mobileTokenStore.get(auth.slice(7));
      if (entry) (entry as any).pushToken = token;
    }

    res.json({ success: true });
  });

  app.post("/api/auth/update-role", async (req: Request, res: Response) => {
    const s = req.session as any;
    if (!s.userId) return res.status(401).json({ message: "Not authenticated" });

    const { role } = req.body;
    if (role !== "papa" && role !== "mama") {
      return res.status(400).json({ message: "Invalid role" });
    }
    await db.update(users).set({ role }).where(eq(users.id, s.userId));
    s.role = role;

    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) {
      const entry = mobileTokenStore.get(auth.slice(7));
      if (entry) entry.role = role;
    }

    res.json({ success: true, role });
  });

  app.post("/api/auth/join-family", async (req: Request, res: Response) => {
    const s = req.session as any;
    if (!s.userId) return res.status(401).json({ message: "Not authenticated" });

    const { familyId } = req.body;
    if (!familyId) return res.status(400).json({ message: "Family ID required" });

    await db.update(users).set({ familyId }).where(eq(users.id, s.userId));
    s.familyId = familyId;

    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) {
      const entry = mobileTokenStore.get(auth.slice(7));
      if (entry) entry.familyId = familyId;
    }

    res.json({ success: true, familyId });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ success: true });
    });
  });
}
