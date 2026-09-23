import type { Express, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  children,
  healthRecords,
  logs,
  parentAccess,
  supporterAccounts,
  users,
} from "@shared/schema";

/**
 * This module is deliberately a fixture workbench, not an authentication
 * provider.  Every identity and every row it can create is fixed to this
 * namespace.  In particular, do not replace these values with a real
 * provider's subject/user id.
 */
export const SUPPORTER_DEVELOPMENT_FAMILY_ID = "supporter-dev-family-budounoki";
export const SUPPORTER_DEVELOPMENT_PARENT_LINE_USER_ID =
  "dev-only:supporter-development:parent";
export const SUPPORTER_DEVELOPMENT_FACILITY_LINE_USER_ID =
  "dev-only:supporter-development:facility";
export const SUPPORTER_DEVELOPMENT_PUBLIC_CODE = "BUDOUNOKI-DEV";
export const SUPPORTER_DEVELOPMENT_INVITE_ADDRESS = "BUDOUNOKI-DEV";
export const SUPPORTER_DEVELOPMENT_FACILITY_NAME = "ぶどうの木";

const PARENT_DISPLAY_NAME = "開発用 保護者";
const CHILDREN = [
  {
    name: "ひなた（開発用）",
    birthday: "2024-05-15",
    color: "#805AAA",
  },
  {
    name: "そら（開発用）",
    birthday: "2024-11-02",
    color: "#5B9BD5",
  },
] as const;
const FIXTURE_LOCK_KEY = "supporter-development:budounoki";
const MILK_FIXTURE_MARKER =
  "fixture:supporter-development:milk-before-start";
const ALLERGY_FIXTURE_MARKER =
  "fixture:supporter-development:allergy-example";
const HANDOFF_FIXTURE_MARKER =
  "fixture:supporter-development:handoff-example";
const FIXTURE_PAST_DATE = new Date("2020-01-02T03:04:05.000Z");

export type SupporterDevelopmentPersona = "parent" | "facility";

type DevelopmentEnvironment = {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  SUPPORTER_DEV_FIXTURES_ENABLED?: string;
  SUPPORTER_ACCESS_ENABLED?: string;
  SUPPORTER_DEV_DATABASE_NAME?: string;
};

/**
 * Pure environment/database-name portion of the development gate.
 *
 * The route additionally verifies current_database() immediately before
 * fixture writes.  Passing currentDatabase here is useful to tests and makes
 * the exact-match rule explicit without making this helper perform I/O.
 */
export function isSupporterDevelopmentEnabled(
  env: DevelopmentEnvironment = process.env,
  currentDatabase?: string,
): boolean {
  const expectedDatabase = env.SUPPORTER_DEV_DATABASE_NAME;
  if (
    env.NODE_ENV !== "development" ||
    env.SUPPORTER_DEV_FIXTURES_ENABLED !== "true" ||
    env.SUPPORTER_ACCESS_ENABLED !== "true" ||
    typeof expectedDatabase !== "string" ||
    expectedDatabase.length === 0
  ) {
    return false;
  }
  return currentDatabase === undefined || currentDatabase === expectedDatabase;
}

function currentDatabaseName(result: unknown): string | null {
  const row = (result as { rows?: Array<Record<string, unknown>> })?.rows?.[0];
  if (!row) return null;
  const value = row.database_name ?? row.current_database;
  return typeof value === "string" ? value : null;
}

async function databaseGate(
  database: any = db,
  env: DevelopmentEnvironment = process.env,
): Promise<boolean> {
  if (!isSupporterDevelopmentEnabled(env)) return false;
  const result = await database.execute(sql`SELECT current_database() AS database_name`);
  const actual = currentDatabaseName(result);
  return typeof actual === "string" && isSupporterDevelopmentEnabled(env, actual);
}

function developmentGateMessage(env: DevelopmentEnvironment = process.env): string {
  if (env.NODE_ENV !== "development") {
    return "開発環境でのみ利用できる手動検証ワークベンチです。";
  }
  if (env.SUPPORTER_DEV_FIXTURES_ENABLED !== "true") {
    return "SUPPORTER_DEV_FIXTURES_ENABLED=true が必要です。";
  }
  if (env.SUPPORTER_ACCESS_ENABLED !== "true") {
    return "SUPPORTER_ACCESS_ENABLED=true が必要です。";
  }
  if (!env.SUPPORTER_DEV_DATABASE_NAME) {
    return "SUPPORTER_DEV_DATABASE_NAME が設定されていません。";
  }
  return "開発用データベース名が一致しないため無効化されています。";
}

function sessionSnapshot(req: Request) {
  const session = req.session as any;
  const persona =
    session.supporterDevFixture === true &&
    (session.supporterDevPersona === "parent" ||
      session.supporterDevPersona === "facility")
      ? session.supporterDevPersona
      : null;
  return {
    authenticated:
      typeof session.userId === "number" && Number.isInteger(session.userId),
    persona,
    ...(persona && typeof session.displayName === "string"
      ? { displayName: session.displayName }
      : {}),
  };
}

function disabled(res: Response, req: Request, message?: string) {
  return res.status(404).json({
    enabled: false,
    session: sessionSnapshot(req),
    message: message || developmentGateMessage(),
  });
}

async function requireDevelopmentGate(
  req: Request,
  res: Response,
): Promise<boolean> {
  try {
    if (!(await databaseGate())) {
      disabled(res, req);
      return false;
    }
    return true;
  } catch {
    // A missing additive schema or an unavailable database must never turn
    // this into an identity or fixture-provisioning path.
    disabled(res, req, "開発用ワークベンチを利用できるデータベースではありません。");
    return false;
  }
}

function requestIsSameOrigin(req: Request): boolean {
  // Browser fetches send Origin, while a same-origin form/navigation can
  // send only Referer.  If either is supplied, compare it to the request
  // origin.  Absence is retained for simple test clients and old browsers;
  // SameSite=Lax still prevents the session cookie on cross-site POSTs.
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  const requestOrigin = host ? `${protocol}://${host}` : null;
  const origin = req.get("origin");
  if (origin && !requestOrigin) return false;
  if (origin && requestOrigin && origin !== requestOrigin) return false;

  const referer = req.get("referer");
  if (referer && !requestOrigin) return false;
  if (referer && requestOrigin) {
    try {
      if (new URL(referer).origin !== requestOrigin) return false;
    } catch {
      return false;
    }
  }

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return false;
  }
  return true;
}

class FixtureConflictError extends Error {
  status = 409;
}

async function ensureUser(
  tx: any,
  lineUserId: string,
  displayName: string,
  role: string,
): Promise<typeof users.$inferSelect> {
  const [existing] = await tx
    .select()
    .from(users)
    .where(eq(users.lineUserId, lineUserId))
    .limit(1);
  if (existing && existing.familyId !== SUPPORTER_DEVELOPMENT_FAMILY_ID) {
    throw new FixtureConflictError(
      "固定された開発用ユーザーが別の家族に紐付いています。",
    );
  }
  if (existing) {
    const [updated] = await tx
      .update(users)
      .set({
        displayName,
        role,
        familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
        pictureUrl: null,
        invitationVerified: true,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await tx
    .insert(users)
    .values({
      lineUserId,
      displayName,
      familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
      role,
      pictureUrl: null,
      invitationVerified: true,
    })
    .returning();
  return created;
}

async function ensureParentAccess(tx: any, parentUserId: number) {
  const [existing] = await tx
    .select()
    .from(parentAccess)
    .where(
      and(
        eq(parentAccess.userId, parentUserId),
        eq(parentAccess.familyId, SUPPORTER_DEVELOPMENT_FAMILY_ID),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.role !== "mama" && existing.role !== "papa") {
      throw new FixtureConflictError("開発用親ユーザーの権限が不正です。");
    }
    return existing;
  }
  const [created] = await tx
    .insert(parentAccess)
    .values({
      userId: parentUserId,
      familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
      role: "mama",
      verifiedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [concurrent] = await tx
    .select()
    .from(parentAccess)
    .where(
      and(
        eq(parentAccess.userId, parentUserId),
        eq(parentAccess.familyId, SUPPORTER_DEVELOPMENT_FAMILY_ID),
      ),
    )
    .limit(1);
  if (!concurrent) throw new Error("開発用親権限の作成に失敗しました。");
  return concurrent;
}

async function ensureChild(tx: any, definition: (typeof CHILDREN)[number]) {
  const [existing] = await tx
    .select()
    .from(children)
    .where(
      and(
        eq(children.familyId, SUPPORTER_DEVELOPMENT_FAMILY_ID),
        eq(children.name, definition.name),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.birthday !== definition.birthday || existing.color !== definition.color) {
      const [updated] = await tx
        .update(children)
        .set({ birthday: definition.birthday, color: definition.color })
        .where(eq(children.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }
  const [created] = await tx
    .insert(children)
    .values({
      familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
      name: definition.name,
      birthday: definition.birthday,
      color: definition.color,
    })
    .returning();
  return created;
}

async function ensureFacilityAccount(
  tx: any,
  facilityUserId: number,
): Promise<typeof supporterAccounts.$inferSelect> {
  const [byCode] = await tx
    .select()
    .from(supporterAccounts)
    .where(eq(supporterAccounts.publicCode, SUPPORTER_DEVELOPMENT_PUBLIC_CODE))
    .limit(1);
  const [byAddress] = await tx
    .select()
    .from(supporterAccounts)
    .where(eq(supporterAccounts.inviteAddress, SUPPORTER_DEVELOPMENT_INVITE_ADDRESS))
    .limit(1);
  if (byCode && byAddress && byCode.id !== byAddress.id) {
    throw new FixtureConflictError("開発用サポーター識別子が別々のアカウントに使われています。");
  }
  const existing = byCode || byAddress;
  if (existing) {
    if (
      (existing.userId !== null && existing.userId !== facilityUserId) ||
      existing.publicCode !== SUPPORTER_DEVELOPMENT_PUBLIC_CODE ||
      existing.inviteAddress !== SUPPORTER_DEVELOPMENT_INVITE_ADDRESS
    ) {
      throw new FixtureConflictError(
        "開発用サポーターアカウントが別のユーザーに紐付いています。",
      );
    }
    const [updated] = await tx
      .update(supporterAccounts)
      .set({
        userId: facilityUserId,
        displayName: SUPPORTER_DEVELOPMENT_FACILITY_NAME,
        kind: "facility",
        isActive: true,
      })
      .where(eq(supporterAccounts.id, existing.id))
      .returning();
    return updated;
  }
  const [accountForUser] = await tx
    .select()
    .from(supporterAccounts)
    .where(eq(supporterAccounts.userId, facilityUserId))
    .limit(1);
  if (accountForUser) {
    throw new FixtureConflictError(
      "開発用施設ユーザーには別のサポーターアカウントがあります。",
    );
  }
  const [created] = await tx
    .insert(supporterAccounts)
    .values({
      userId: facilityUserId,
      inviteAddress: SUPPORTER_DEVELOPMENT_INVITE_ADDRESS,
      publicCode: SUPPORTER_DEVELOPMENT_PUBLIC_CODE,
      displayName: SUPPORTER_DEVELOPMENT_FACILITY_NAME,
      kind: "facility",
      isActive: true,
    })
    .returning();
  return created;
}

async function ensureExamples(tx: any, parentUserId: number, childId: number) {
  const [milk] = await tx
    .select({ id: logs.id })
    .from(logs)
    .where(
      and(
        eq(logs.familyId, SUPPORTER_DEVELOPMENT_FAMILY_ID),
        eq(logs.childId, childId),
        eq(logs.message, MILK_FIXTURE_MARKER),
      ),
    )
    .limit(1);
  if (!milk) {
    await tx.insert(logs).values({
      familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
      childId,
      userId: "mama",
      type: "milk",
      points: 10,
      message: MILK_FIXTURE_MARKER,
      createdAt: FIXTURE_PAST_DATE,
      actorAccountId: parentUserId,
      careSource: "parent",
      recorderDisplayName: PARENT_DISPLAY_NAME,
    } as any);
  }

  const [allergy] = await tx
    .select({ id: healthRecords.id })
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.familyId, SUPPORTER_DEVELOPMENT_FAMILY_ID),
        eq(healthRecords.childId, childId),
        eq(healthRecords.title, ALLERGY_FIXTURE_MARKER),
      ),
    )
    .limit(1);
  if (!allergy) {
    await tx.insert(healthRecords).values({
      familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
      childId,
      type: "allergy",
      title: ALLERGY_FIXTURE_MARKER,
      detail: "卵は医師確認済み（手動検証用）",
      recordedAt: "2020-01-02",
      createdAt: FIXTURE_PAST_DATE,
    } as any);
  }

  const [handoff] = await tx
    .select({ id: healthRecords.id })
    .from(healthRecords)
    .where(
      and(
        eq(healthRecords.familyId, SUPPORTER_DEVELOPMENT_FAMILY_ID),
        eq(healthRecords.childId, childId),
        eq(healthRecords.title, HANDOFF_FIXTURE_MARKER),
      ),
    )
    .limit(1);
  if (!handoff) {
    await tx.insert(healthRecords).values({
      familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
      childId,
      type: "health_note",
      title: HANDOFF_FIXTURE_MARKER,
      detail: "次回授乳は保護者へ確認（手動検証用）",
      recordedAt: "2020-01-02",
      createdAt: FIXTURE_PAST_DATE,
    } as any);
  }
}

async function ensureFixture() {
  return db.transaction(async (tx) => {
    // Repeat the database check inside the transaction immediately before
    // taking the fixture lock.  No INSERT/UPDATE is allowed before this.
    const env = process.env;
    const result = await tx.execute(sql`SELECT current_database() AS database_name`);
    const actualDatabase = currentDatabaseName(result);
    if (
      typeof actualDatabase !== "string" ||
      !isSupporterDevelopmentEnabled(env, actualDatabase)
    ) {
      throw new FixtureConflictError(
        "開発用データベース名が一致しないため、フィクスチャを書き込めません。",
      );
    }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${FIXTURE_LOCK_KEY}))`);

    const parent = await ensureUser(
      tx,
      SUPPORTER_DEVELOPMENT_PARENT_LINE_USER_ID,
      PARENT_DISPLAY_NAME,
      "mama",
    );
    const facility = await ensureUser(
      tx,
      SUPPORTER_DEVELOPMENT_FACILITY_LINE_USER_ID,
      SUPPORTER_DEVELOPMENT_FACILITY_NAME,
      "supporter",
    );
    await ensureParentAccess(tx, parent.id);
    const fixtureChildren = [];
    for (const definition of CHILDREN) {
      fixtureChildren.push(await ensureChild(tx, definition));
    }
    const account = await ensureFacilityAccount(tx, facility.id);
    await ensureExamples(tx, parent.id, fixtureChildren[0].id);

    return {
      parent,
      facility,
      account,
      children: fixtureChildren,
    };
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function parsePersona(body: unknown): SupporterDevelopmentPersona {
  return z
    .object({ persona: z.enum(["parent", "facility"]) })
    .strict()
    .parse(body).persona;
}

function respondError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "persona は parent または facility のみ指定できます。未知の項目は使えません。",
    });
  }
  const status =
    typeof (error as any)?.status === "number" ? (error as any).status : 500;
  return res.status(status).json({
    message:
      status === 500
        ? "開発用フィクスチャを準備できませんでした。"
        : error instanceof Error
          ? error.message
          : "開発用フィクスチャを準備できませんでした。",
  });
}

/**
 * Mount after the existing express-session middleware and before the normal
 * supporter routes.  This module never installs a provider, accepts a
 * provider token, or interprets a caller-supplied user/family id.
 */
export function registerSupporterDevelopmentRoutes(app: Express) {
  app.use("/api/supporter/development", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.vary("Cookie");
    next();
  });

  app.get("/api/supporter/development/status", async (req, res) => {
    if (!(await requireDevelopmentGate(req, res))) return;
    const session = sessionSnapshot(req);
    res.json({
      enabled: true,
      session,
      fixture: {
        familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
        publicCode: SUPPORTER_DEVELOPMENT_PUBLIC_CODE,
        inviteAddress: SUPPORTER_DEVELOPMENT_INVITE_ADDRESS,
        displayName: SUPPORTER_DEVELOPMENT_FACILITY_NAME,
      },
    });
  });

  app.post("/api/supporter/development/session", async (req, res) => {
    // Gate before origin/schema handling is intentional: in production,
    // even a request carrying a development cookie is an indistinguishable
    // 404 and cannot discover this workbench.
    if (!(await requireDevelopmentGate(req, res))) return;
    if (!requestIsSameOrigin(req)) {
      return res.status(403).json({ message: "同一オリジンからのみ切り替えできます。" });
    }

    try {
      const persona = parsePersona(req.body);
      const fixture = await ensureFixture();
      const identity =
        persona === "parent"
          ? {
              userId: fixture.parent.id,
              lineUserId: SUPPORTER_DEVELOPMENT_PARENT_LINE_USER_ID,
              familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
              role: "mama",
              displayName: PARENT_DISPLAY_NAME,
              redirect: "/supporter/manage",
            }
          : {
              userId: fixture.facility.id,
              lineUserId: SUPPORTER_DEVELOPMENT_FACILITY_LINE_USER_ID,
              familyId: SUPPORTER_DEVELOPMENT_FAMILY_ID,
              role: "supporter",
              displayName: SUPPORTER_DEVELOPMENT_FACILITY_NAME,
              redirect: "/supporter",
            };

      await regenerateSession(req);
      const session = req.session as any;
      session.userId = identity.userId;
      session.lineUserId = identity.lineUserId;
      session.familyId = identity.familyId;
      session.role = identity.role;
      session.displayName = identity.displayName;
      session.invitationVerified = true;
      session.supporterDevFixture = true;
      session.supporterDevPersona = persona;
      await saveSession(req);

      return res.redirect(303, identity.redirect);
    } catch (error) {
      return respondError(res, error);
    }
  });
}