import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  children,
  healthRecords,
  logs,
  parentAccess,
  sleepSessions,
  supporterAccounts,
  supporterAuditLogs,
  supporterGrants,
  supporterIdempotency,
  users,
} from "@shared/schema";
import {
  parseSupporterFields,
  supporterExportSchema,
  supporterGrantExtensionSchema,
  supporterInvitationSchema,
  supporterRecordInputSchema,
  supporterRecordPatchSchema,
  type SupporterRecordDto,
  type SupporterRecordType,
  type SupporterStatusDto,
} from "@shared/supporter-contract";
import {
  canShareExistingHealthRecord,
  canShareSupporterRecord,
  isActiveGrant,
  isIntervalWithinGrantPeriod,
  isWithinGrantPeriod,
} from "@shared/supporter-policy";

type Actor = { id: number; displayName: string };
type Supporter = typeof supporterAccounts.$inferSelect;
type Grant = typeof supporterGrants.$inferSelect;
type SupporterRecordsPayload = {
  child: { id: number; name: string; birthday: string | null };
  records: SupporterRecordDto[];
  grants: Array<{ id: number; startsAt: string; endsAt: string }>;
  serverNow: string;
};

function familyFromKnownLegacyPath(method: string, path: string): string | null {
  // These are the explicit family-scoped routes registered by the legacy
  // server. Do not treat every `/api/families/:id/*` path as known: a prefix
  // allowlist would turn a newly added or mistyped endpoint into an
  // authorization bypass under strict mode.
  const familyRoutePatterns: Array<[string, RegExp]> = [
    ["GET", /^\/api\/families\/([^/?]+)\/(?:medicine-names|caregiver-medicine-names)$/],
    ["GET", /^\/api\/families\/([^/?]+)\/food-ingredients\/[^/?]+$/],
    ["POST", /^\/api\/families\/([^/?]+)\/food-ingredients(?:\/bulk)?$/],
    ["PATCH", /^\/api\/families\/([^/?]+)\/(?:food-ingredients|custom-childcare-items)\/[^/?]+$/],
    ["DELETE", /^\/api\/families\/([^/?]+)\/(?:food-ingredients|custom-childcare-items|custom-quick-actions)\/[^/?]+$/],
    ["GET", /^\/api\/families\/([^/?]+)\/custom-childcare-items$/],
    ["POST", /^\/api\/families\/([^/?]+)\/custom-childcare-items$/],
    ["GET", /^\/api\/families\/([^/?]+)\/custom-quick-actions$/],
    ["POST", /^\/api\/families\/([^/?]+)\/custom-quick-actions$/],
  ];
  for (const [routeMethod, pattern] of familyRoutePatterns) {
    if (method === routeMethod) {
      const match = path.match(pattern);
      if (match) return match[1];
    }
  }
  if (method !== "GET") return null;
  const direct = path.match(/^\/api\/(?:children|logs|settings|events|coupons|user-coupons|growth|skills|we-board|health-records)\/([^/?]+)$/);
  if (direct) return direct[1];
  const notifications = path.match(/^\/api\/notifications\/([^/?]+)\/[^/?]+$/);
  if (notifications) return notifications[1];
  const sleep = path.match(/^\/api\/sleep\/(?:checklist|routines|routine-logs)\/([^/?]+)(?:\/[^/?]+)?$/);
  if (sleep) return sleep[1];
  const sessions = path.match(/^\/api\/sleep-sessions\/([^/?]+)(?:\/active)?$/);
  if (sessions) return sessions[1];
  const vaccinations = path.match(/^\/api\/(?:vaccination-records|custom-vaccines)\/([^/?]+)(?:\/[^/?]+)?$/);
  if (vaccinations) return vaccinations[1];
  return null;
}

function isKnownLegacyDataRoute(method: string, path: string): boolean {
  if (familyFromKnownLegacyPath(method, path)) return true;
  if (path === "/api/family/id-status") return method === "GET";
  if (path === "/api/family/rotate-id") return method === "POST";
  if (path === "/api/family/rotate-code") return method === "POST";
  if ([
    "/api/children", "/api/logs", "/api/logs/bulk-delete", "/api/settings",
    "/api/sleep-success", "/api/sleep-sessions/start", "/api/sleep-sessions/manual",
    "/api/events", "/api/coupons", "/api/coupons/exchange", "/api/sleep/checklist",
    "/api/sleep/routines", "/api/sleep/routine-logs/complete", "/api/growth",
    "/api/skills/complete", "/api/skills/uncomplete", "/api/feedbacks", "/api/we-board",
    "/api/health-records", "/api/vaccination-records", "/api/vaccine-reminders/sync",
    "/api/custom-vaccines", "/api/diaries",
  ].includes(path)) return true;
  return [
    /^\/api\/children\/\d+$/,
    /^\/api\/logs\/\d+\/(?:update|update-time)$/,
    /^\/api\/logs\/\d+\/sleep-detail$/,
    /^\/api\/logs\/\d+$/,
    /^\/api\/sleep-sessions\/\d+(?:\/(?:update-time|end))?$/,
    /^\/api\/events\/\d+(?:\/complete)?$/,
    /^\/api\/coupons\/\d+(?:\/update)?$/,
    /^\/api\/user-coupons\/\d+\/redeem$/,
    /^\/api\/sleep\/routines\/\d+$/,
    /^\/api\/growth\/\d+$/,
    /^\/api\/notifications\/\d+\/read$/,
    /^\/api\/health-records\/\d+(?:\/update)?$/,
    /^\/api\/vaccination-records\/\d+(?:\/update)?$/,
    /^\/api\/custom-vaccines\/\d+$/,
    /^\/api\/diaries\/\d+$/,
  ].some((pattern) => pattern.test(path));
}

function isKnownAdminRoute(method: string, path: string): boolean {
  return (method === "POST" && [
      "/api/admin/generate-codes",
      "/api/admin/supporter/accounts",
      "/api/admin/supporter/parents",
    ].includes(path))
    || (method === "GET" && [
      "/api/admin/invitation-codes",
      "/api/admin/users",
      "/api/admin/stats",
      "/api/admin/feedbacks",
      "/api/admin/supporter/accounts",
    ].includes(path));
}

/** Checks the existing Admin UI's x-admin-key without treating it as family access. */
export function isVerifiedAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_KEY?.trim();
  const supplied = req.get("x-admin-key");
  if (!expected || !supplied) return false;
  // Compare fixed-size digests so an invalid key is never checked with a
  // length-dependent string comparison.
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function supporterFeatureEnabled(env = process.env): boolean {
  if (env.SUPPORTER_ACCESS_ENABLED !== "true") return false;
  return env.NODE_ENV !== "production" || env.SUPPORTER_AUTH_MIGRATION_READY === "true";
}

function featureMessage(): string | undefined {
  if (process.env.SUPPORTER_ACCESS_ENABLED !== "true") {
    return "サポーター権限は現在有効ではありません。";
  }
  if (!supporterFeatureEnabled()) {
    return "本番では外部認証連携の移行準備が完了するまでサポーター権限を利用できません。";
  }
  return undefined;
}

function actorId(req: Request): number | null {
  const session = (req.session as any) || {};
  // Development fixture sessions are intentionally distinguishable from
  // real auth sessions.  They are accepted only while all three explicit
  // development gates are enabled; production or a missing flag fails
  // closed without importing the fixture worker.
  if (session.supporterDevFixture === true && !(
    process.env.NODE_ENV === "development"
    && process.env.SUPPORTER_DEV_FIXTURES_ENABLED === "true"
    && process.env.SUPPORTER_ACCESS_ENABLED === "true"
  )) {
    return null;
  }
  const value = session.userId;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  // Existing auth adapters normally store a numeric users.id in the
  // session. Accepting its serialized form keeps this boundary provider
  // neutral (native LINE/Google/Apple adapters may serialize the common
  // account id differently), while still rejecting arbitrary identity
  // strings and missing identity.
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

async function getActor(req: Request): Promise<Actor | null> {
  const id = actorId(req);
  if (!id) return null;
  if ((req.session as any)?.supporterDevFixture === true) {
    const scope = await db.execute(sql`SELECT current_database() = ${process.env.SUPPORTER_DEV_DATABASE_NAME || ""} AS permitted`);
    if (scope.rows[0]?.permitted !== true) return null;
  }
  const [user] = await db.select({ id: users.id, displayName: users.displayName })
    .from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

async function getSupporter(userId: number): Promise<Supporter | null> {
  const [account] = await db.select().from(supporterAccounts)
    .where(and(eq(supporterAccounts.userId, userId), eq(supporterAccounts.isActive, true)))
    .limit(1);
  return account ?? null;
}

async function verifiedParentFamilies(userId: number): Promise<string[]> {
  const rows = await db.select({ familyId: parentAccess.familyId }).from(parentAccess)
    .where(and(
      eq(parentAccess.userId, userId),
      inArray(parentAccess.role, ["papa", "mama"]),
      sql`${parentAccess.verifiedAt} IS NOT NULL`,
    ));
  return rows.map((row) => row.familyId);
}

async function requireActor(req: Request, res: Response): Promise<Actor | null> {
  const actor = await getActor(req);
  if (!actor) {
    res.status(401).json({ message: "ログイン済みのアカウントが必要です。" });
    return null;
  }
  return actor;
}

async function requireSupporter(req: Request, res: Response): Promise<{ actor: Actor; supporter: Supporter } | null> {
  if (!supporterFeatureEnabled()) {
    res.status(503).json({ message: featureMessage() });
    return null;
  }
  const actor = await requireActor(req, res);
  if (!actor) return null;
  const supporter = await getSupporter(actor.id);
  if (!supporter) {
    res.status(403).json({ message: "このログインには有効なサポーターアカウントが紐付いていません。" });
    return null;
  }
  return { actor, supporter };
}

async function requireParent(req: Request, res: Response): Promise<Actor | null> {
  if (!supporterFeatureEnabled()) {
    res.status(503).json({ message: featureMessage() });
    return null;
  }
  const actor = await requireActor(req, res);
  if (!actor) return null;
  if ((await verifiedParentFamilies(actor.id)).length === 0) {
    res.status(403).json({
      message: "このログインには確認済みのパパ・ママ権限がありません。認証移行後に parent_access を確認してください。",
    });
    return null;
  }
  return actor;
}

function iso(value: Date | null | undefined): string {
  if (!value) throw new Error("supporter record timestamp is missing");
  return new Date(value).toISOString();
}

function toRecordDto(
  record: typeof logs.$inferSelect,
  currentSupporterId: number,
  sleepDurationMin?: number | null,
): SupporterRecordDto {
  const fields: Record<string, string | number | boolean | null> = {};
  // DTO projection is type-specific. Never add a column merely because a
  // malformed/legacy row happens to have data in it.
  if ((record.type === "milk" || record.type === "formula") && record.formulaMl !== null) fields.formulaMl = record.formulaMl;
  if ((record.type === "milk" || record.type === "formula") && record.expressedMl !== null) fields.expressedMl = record.expressedMl;
  if (record.type === "temp" && record.bodyTemperature !== null) fields.bodyTemperature = record.bodyTemperature;
  if (record.type === "medicine" && record.medicineName !== null) fields.medicineName = record.medicineName;
  if (record.type === "medicine" && record.medicineDose !== null) fields.medicineDose = record.medicineDose;
  if (["food", "diaper", "sleep", "symptom"].includes(record.type) && record.subType !== null) fields.subType = record.subType;
  if (record.type === "sleep" && sleepDurationMin !== undefined && sleepDurationMin !== null) {
    fields.durationMin = sleepDurationMin;
  }
  return {
    id: record.id,
    type: record.type as SupporterRecordType,
    createdAt: iso(record.createdAt),
    ...(record.message ? { message: record.message } : {}),
    recorderDisplayName: record.recorderDisplayName || "保護者",
    canEdit: record.supporterAccountId === currentSupporterId,
    fields,
  };
}

function toHealthDto(record: typeof healthRecords.$inferSelect): SupporterRecordDto {
  const type = record.type === "allergy" ? "allergy_report" : "handoff_note";
  const detail = record.detail || record.title;
  return {
    id: `health:${record.id}`,
    type,
    createdAt: record.createdAt ? iso(record.createdAt) : `${record.recordedAt || "1970-01-01"}T00:00:00.000Z`,
    ...(detail ? { message: detail } : {}),
    recorderDisplayName: "保護者",
    canEdit: false,
    fields: {},
  };
}

function fieldsToLogData(fields: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of ["message", "formulaMl", "expressedMl", "bodyTemperature", "medicineName", "medicineDose", "subType"]) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }
  return data;
}

function fingerprint(payload: unknown): string {
  const normalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((result: Record<string, unknown>, key) => {
        result[key] = normalize(value[key]);
        return result;
      }, {});
    }
    return value;
  };
  return createHash("sha256").update(JSON.stringify(normalize(payload))).digest("hex");
}

async function audit(
  tx: any,
  values: {
    actorAccountId?: number | null;
    supporterAccountId?: number | null;
    supporterGrantId?: number | null;
    action: string;
    requestId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.insert(supporterAuditLogs).values({
    actorAccountId: values.actorAccountId ?? null,
    supporterAccountId: values.supporterAccountId ?? null,
    supporterGrantId: values.supporterGrantId ?? null,
    action: values.action,
    requestId: values.requestId ?? null,
    before: values.before ?? null,
    after: values.after ?? null,
  });
}

async function idempotentRecord<T extends Record<string, unknown>>(
  tx: any,
  supporterAccountId: number,
  action: string,
  requestId: string,
  payload: unknown,
  authorize: () => Promise<void>,
  work: () => Promise<T>,
): Promise<T> {
  const payloadFingerprint = fingerprint(payload);
  // Serialise a particular account/action/requestId even when two HTTP
  // retries use different grants. This closes the check-then-insert race
  // before any care record is written.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${supporterAccountId}:${action}:${requestId}`}))`);
  // Authorization must run before looking up a replay.  Returning a cached
  // response after a grant expires or is revoked would let a stale requestId
  // bypass the same server-side expiry checks as a new request.
  await authorize();
  const [existing] = await tx.select().from(supporterIdempotency).where(and(
    eq(supporterIdempotency.supporterAccountId, supporterAccountId),
    eq(supporterIdempotency.action, action),
    eq(supporterIdempotency.requestId, requestId),
  )).limit(1);
  if (existing) {
    if (existing.payloadFingerprint !== payloadFingerprint) {
      const error: any = new Error("requestId was already used with a different payload");
      error.status = 409;
      throw error;
    }
    return existing.response as T;
  }
  const response = await work();
  await tx.insert(supporterIdempotency).values({
    supporterAccountId,
    action,
    requestId,
    payloadFingerprint,
    response,
  }).onConflictDoNothing();
  return response;
}

async function lockedGrant(
  tx: any,
  supporterAccountId: number,
  childId: number,
  grantId: number,
): Promise<Grant | null> {
  await tx.execute(sql`SELECT id FROM supporter_grants WHERE id = ${grantId} FOR UPDATE`);
  const [grant] = await tx.select().from(supporterGrants).where(and(
    eq(supporterGrants.id, grantId),
    eq(supporterGrants.supporterAccountId, supporterAccountId),
    eq(supporterGrants.childId, childId),
  )).limit(1);
  return grant ?? null;
}

/**
 * A family match on supporter_grants alone is not sufficient authority: a
 * malformed or stale row must not let a parent manage a grant whose child is
 * outside that family's actual children.  Keep the ownership check beside
 * the row lock so extension/revocation cannot race a concurrent change.
 */
async function lockedParentGrant(
  tx: any,
  grantId: number,
  familyIds: string[],
): Promise<Grant | null> {
  await tx.execute(sql`SELECT id FROM supporter_grants WHERE id = ${grantId} FOR UPDATE`);
  const [grant] = await tx.select().from(supporterGrants).where(and(
    eq(supporterGrants.id, grantId),
    inArray(supporterGrants.familyId, familyIds),
  )).limit(1);
  if (!grant) return null;
  const [child] = await tx.select({ id: children.id }).from(children).where(and(
    eq(children.id, grant.childId),
    eq(children.familyId, grant.familyId),
  )).limit(1);
  return child ? grant : null;
}

function requireActiveGrant(grant: Grant | null | undefined, now = new Date()): Grant {
  if (!grant || !isActiveGrant(grant, now)) {
    const error: any = new Error("利用可能な招待期間ではありません。");
    error.status = 403;
    throw error;
  }
  return grant;
}

async function activeGrantsForChild(
  supporterAccountId: number,
  childId: number,
  now = new Date(),
  database: any = db,
) {
  const rows: Grant[] = await database.select().from(supporterGrants).where(and(
    eq(supporterGrants.supporterAccountId, supporterAccountId),
    eq(supporterGrants.childId, childId),
    isNull(supporterGrants.revokedAt),
    sql`${supporterGrants.acceptedAt} IS NOT NULL`,
  ));
  return rows.filter((grant) => isActiveGrant(grant, now));
}

async function requireActiveGrantForChild(
  tx: any,
  supporterAccountId: number,
  childId: number,
  grantId: number,
  now = new Date(),
): Promise<{ grant: Grant; child: typeof children.$inferSelect }> {
  const grant = requireActiveGrant(
    await lockedGrant(tx, supporterAccountId, childId, grantId),
    now,
  );
  const [child] = await tx.select().from(children).where(and(
    eq(children.id, childId),
    eq(children.familyId, grant.familyId),
  )).limit(1);
  if (!child) {
    const error: any = new Error("お子さまへのアクセス権がありません。");
    error.status = 403;
    throw error;
  }
  return { grant, child };
}

async function lockedActiveGrantsForChild(
  tx: any,
  supporterAccountId: number,
  childId: number,
  now = new Date(),
): Promise<Grant[]> {
  // Lock every candidate for this child before making the union-of-grants
  // authorization decision. A concurrent revoke therefore waits until the
  // record mutation and its audit entry are committed or rolled back.
  await tx.execute(sql`
    SELECT id FROM supporter_grants
    WHERE supporter_account_id = ${supporterAccountId} AND child_id = ${childId}
    FOR UPDATE
  `);
  const [child] = await tx.select({ familyId: children.familyId }).from(children)
    .where(eq(children.id, childId)).limit(1);
  if (!child) return [];
  return (await activeGrantsForChild(supporterAccountId, childId, now, tx))
    .filter((grant) => grant.familyId === child.familyId);
}

async function lockedActiveGrantsForAccount(
  tx: any,
  supporterAccountId: number,
  now = new Date(),
): Promise<Grant[]> {
  await tx.execute(sql`
    SELECT id FROM supporter_grants
    WHERE supporter_account_id = ${supporterAccountId}
    FOR UPDATE
  `);
  const rows: Grant[] = await tx.select().from(supporterGrants).where(
    and(
      eq(supporterGrants.supporterAccountId, supporterAccountId),
      isNull(supporterGrants.revokedAt),
      sql`${supporterGrants.acceptedAt} IS NOT NULL`,
    ),
  );
  return rows.filter((grant) => isActiveGrant(grant, now));
}

async function recordResponse(
  supporter: Supporter,
  childId: number,
  grantIds?: number[],
  database: any = db,
): Promise<SupporterRecordsPayload> {
  const now = new Date();
  const active = await activeGrantsForChild(supporter.id, childId, now, database);
  const grants = grantIds
    ? active.filter((grant) => grantIds.includes(grant.id))
    : active;
  if (grantIds && grants.length !== new Set(grantIds).size) {
    const error: any = new Error("選択した招待期間は現在利用できません。");
    error.status = 403;
    throw error;
  }
  if (grants.length === 0) {
    const error: any = new Error("お子さまへの現在有効な招待がありません。");
    error.status = 403;
    throw error;
  }
  const [child]: Array<typeof children.$inferSelect> = await database.select().from(children).where(eq(children.id, childId)).limit(1);
  if (!child || !grants.every((grant) => grant.familyId === child.familyId && isActiveGrant(grant, now))) {
    const error: any = new Error("お子さまへのアクセス権がありません。");
    error.status = 403;
    throw error;
  }

  const candidateLogs: Array<typeof logs.$inferSelect> = await database.select().from(logs).where(and(
    eq(logs.childId, childId),
    eq(logs.familyId, child.familyId),
    isNull(logs.deletedAt),
  ));
  const sleepSessionIds = candidateLogs
    .filter((row) => row.type === "sleep" && row.sleepSessionId !== null)
    .map((row) => row.sleepSessionId!);
  const sleepRows = sleepSessionIds.length
    ? await database.select().from(sleepSessions).where(and(
      inArray(sleepSessions.id, sleepSessionIds),
      eq(sleepSessions.familyId, child.familyId),
      eq(sleepSessions.childId, childId),
    ))
    : [];
  const sleepDurationById = new Map<number, number | null>(
    sleepRows.map((session: typeof sleepSessions.$inferSelect) => [session.id, session.durationMin]),
  );
  const supporterRows = candidateLogs
    .filter((row) => {
      const type = row.type as SupporterRecordType;
      return ["milk", "formula", "food", "diaper", "sleep", "bath", "temp", "symptom", "medicine", "allergy_report", "allergy_observation", "handoff_note"].includes(type)
        && row.createdAt && new Date(row.createdAt) <= now
        && canShareSupporterRecord(type, new Date(row.createdAt), grants);
    })
    .map((row) => {
      const dto = toRecordDto(row, supporter.id, row.sleepSessionId ? sleepDurationById.get(row.sleepSessionId) : undefined);
      // Historical allergy/handoff rows can be read as an exception, but
      // their owner cannot edit/delete them unless their timestamp is inside
      // a currently accessible care period.
      if (dto.canEdit && !isWithinGrantPeriod(new Date(row.createdAt!), grants)) {
        dto.canEdit = false;
      }
      return dto;
    });
  const healthCandidates: Array<typeof healthRecords.$inferSelect> = await database.select().from(healthRecords).where(and(
    eq(healthRecords.familyId, child.familyId),
    eq(healthRecords.childId, childId),
  ));
  const healthRows = healthCandidates.filter((row) => canShareExistingHealthRecord(row.type, row.childId))
    .map(toHealthDto);
  const records = [...supporterRows, ...healthRows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    child: { id: child.id, name: child.name, birthday: child.birthday },
    records,
    grants: grants.map((grant) => ({ id: grant.id, startsAt: iso(grant.startsAt), endsAt: iso(grant.endsAt) })),
    serverNow: now.toISOString(),
  };
}

function respondError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "処理に失敗しました。";
  const status = typeof (error as any)?.status === "number" ? (error as any).status : 400;
  return res.status(status).json({ message });
}

/**
 * Register only supporter endpoints. The caller must mount session/auth first.
 * It intentionally does not register any identity provider or create accounts.
 */
export function registerSupporterRoutes(app: Express) {
  app.use("/api/supporter", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.vary("Cookie");
    next();
  });
  app.get("/api/supporter/status", async (req, res) => {
    const enabled = supporterFeatureEnabled();
    const actor = await getActor(req);
    // A status check must remain safe before the additive schema has been
    // applied. Do not query new tables while the feature is gated off.
    if (!enabled) {
      const status: SupporterStatusDto = {
        enabled: false,
        authenticated: !!actor,
        canManage: false,
        isSupporter: false,
        message: featureMessage(),
      };
      return res.json(status);
    }
    const supporter = actor ? await getSupporter(actor.id) : null;
    const canManage = actor ? (await verifiedParentFamilies(actor.id)).length > 0 : false;
    const status: SupporterStatusDto = {
      enabled,
      authenticated: !!actor,
      canManage,
      isSupporter: !!supporter,
      ...(supporter ? { displayName: supporter.displayName } : {}),
      ...(!enabled ? { message: featureMessage() } : {}),
    };
    res.json(status);
  });

  app.get("/api/supporter/children", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    const payload = await db.transaction(async (tx) => {
      const now = new Date();
      // Hold all this account's grant rows while the list and child mapping
      // are read. A concurrent revoke cannot produce a grant list that was
      // authorized before the revoke but assembled after it.
      const grants = await lockedActiveGrantsForAccount(tx, auth.supporter.id, now);
      const ids = Array.from(new Set(grants.map((grant) => grant.childId)));
      const rows = ids.length ? await tx.select().from(children).where(inArray(children.id, ids)) : [];
      const validRows = rows.filter((child) => grants.some(
        (grant) => grant.childId === child.id && grant.familyId === child.familyId,
      ));
      return {
        children: validRows.map((child) => ({
          id: child.id,
          name: child.name,
          birthday: child.birthday,
          grants: grants.filter((grant) => grant.childId === child.id && grant.familyId === child.familyId)
            .map((grant) => ({ id: grant.id, startsAt: iso(grant.startsAt), endsAt: iso(grant.endsAt) })),
        })),
        serverNow: now.toISOString(),
      };
    });
    res.json(payload);
  });

  app.get("/api/supporter/children/:childId/records", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    try {
      const childId = Number(req.params.childId);
      const payload = await db.transaction(async (tx) => {
        await lockedActiveGrantsForChild(tx, auth.supporter.id, childId);
        return recordResponse(auth.supporter, childId, undefined, tx);
      });
      res.json(payload);
    } catch (error) {
      respondError(res, error);
    }
  });

  app.post("/api/supporter/children/:childId/records", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    try {
      const childId = Number(req.params.childId);
      const input = supporterRecordInputSchema.parse(req.body);
      const fields = parseSupporterFields(input.type, input.fields);
      const result = await db.transaction(async (tx) => idempotentRecord(
        tx, auth.supporter.id, "create", input.requestId, { childId, ...input },
        async () => {
          await requireActiveGrantForChild(tx, auth.supporter.id, childId, input.grantId);
        },
        async () => {
          const grant = requireActiveGrant(await lockedGrant(tx, auth.supporter.id, childId, input.grantId));
          const occurredAt = new Date(input.occurredAt);
          if (occurredAt > new Date()) {
            const error: any = new Error("未来の記録は保存できません。");
            error.status = 400;
            throw error;
          }
          if (!isWithinGrantPeriod(occurredAt, [grant])) {
            const error: any = new Error("記録時刻が選択した招待期間に含まれていません。");
            error.status = 403;
            throw error;
          }
          const [child] = await tx.select().from(children).where(and(
            eq(children.id, childId), eq(children.familyId, grant.familyId),
          )).limit(1);
          if (!child) throw new Error("お子さまが見つかりません。");
          let sleepSessionId: number | null = null;
          let sleepDurationMin: number | null = null;
          if (input.type === "sleep") {
            sleepDurationMin = Number(fields.durationMin);
            const endsAt = new Date(occurredAt.getTime() + sleepDurationMin * 60_000);
            if (endsAt > new Date() || !isIntervalWithinGrantPeriod(occurredAt, endsAt, [grant])) {
              const error: any = new Error("睡眠の開始・終了時刻は現在までの利用可能期間内にしてください。");
              error.status = 403;
              throw error;
            }
            const [session] = await tx.insert(sleepSessions).values({
              familyId: child.familyId,
              childId,
              startedAt: occurredAt,
              endedAt: endsAt,
              durationMin: sleepDurationMin,
              createdBy: `supporter:${auth.supporter.id}`,
              performedBy: null,
            }).returning();
            sleepSessionId = session.id;
          }
          const [record] = await tx.insert(logs).values({
            familyId: child.familyId,
            childId,
            // The legacy non-null column has no supporter semantic. The
            // attribution columns below are authoritative.
            userId: "supporter",
            type: input.type,
            points: 0,
            createdAt: occurredAt,
            actorAccountId: auth.actor.id,
            supporterAccountId: auth.supporter.id,
            supporterGrantId: grant.id,
            careSource: "supporter",
            recorderDisplayName: auth.supporter.displayName,
            sleepSessionId,
            ...fieldsToLogData(fields),
          } as any).returning();
          const dto = toRecordDto(record, auth.supporter.id, sleepDurationMin);
          await audit(tx, {
            actorAccountId: auth.actor.id, supporterAccountId: auth.supporter.id, supporterGrantId: grant.id,
            action: "create", requestId: input.requestId, after: dto,
          });
          return dto;
        },
      ));
      res.status(201).json(result);
    } catch (error) {
      respondError(res, error);
    }
  });

  app.patch("/api/supporter/children/:childId/records/:recordId", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    try {
      const childId = Number(req.params.childId);
      const recordId = Number(req.params.recordId);
      const input = supporterRecordPatchSchema.parse(req.body);
      const result = await db.transaction(async (tx) => idempotentRecord(
        tx, auth.supporter.id, "update", input.requestId, { childId, recordId, ...input },
        async () => {
          const activePeriods = await lockedActiveGrantsForChild(tx, auth.supporter.id, childId);
          requireActiveGrant(activePeriods.find((candidate) => candidate.id === input.grantId));
        },
        async () => {
          const activePeriods = await lockedActiveGrantsForChild(tx, auth.supporter.id, childId);
          const grant = requireActiveGrant(activePeriods.find((candidate) => candidate.id === input.grantId));
          await tx.execute(sql`SELECT id FROM logs WHERE id = ${recordId} FOR UPDATE`);
          const [oldRecord] = await tx.select().from(logs).where(and(
            eq(logs.id, recordId), eq(logs.childId, childId), eq(logs.supporterAccountId, auth.supporter.id), isNull(logs.deletedAt),
          )).limit(1);
          if (!oldRecord) {
            const error: any = new Error("自分が入力した記録のみ訂正できます。");
            error.status = 403;
            throw error;
          }
          const type = oldRecord.type as SupporterRecordType;
          const fields = parseSupporterFields(type, input.fields);
          const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date(oldRecord.createdAt!);
          if (occurredAt > new Date()) {
            const error: any = new Error("未来の記録には変更できません。");
            error.status = 400;
            throw error;
          }
          // Historical reports/notes are readable exceptions, but a supporter
          // cannot revise a past visit after being invited again.
          if (!isWithinGrantPeriod(occurredAt, activePeriods)) {
            const error: any = new Error("記録時刻が現在の利用可能期間に含まれていません。");
            error.status = 403;
            throw error;
          }
          let sleepDurationMin: number | null | undefined;
          let oldSleepDurationMin: number | null | undefined;
          if (type === "sleep") {
            sleepDurationMin = Number(fields.durationMin);
            const endsAt = new Date(occurredAt.getTime() + sleepDurationMin * 60_000);
            if (endsAt > new Date() || !isIntervalWithinGrantPeriod(occurredAt, endsAt, activePeriods)) {
              const error: any = new Error("睡眠の開始・終了時刻は現在までの利用可能期間内にしてください。");
              error.status = 403;
              throw error;
            }
            if (!oldRecord.sleepSessionId) {
              const error: any = new Error("この睡眠記録には更新可能な睡眠セッションがありません。");
              error.status = 409;
              throw error;
            }
            await tx.execute(sql`SELECT id FROM sleep_sessions WHERE id = ${oldRecord.sleepSessionId} FOR UPDATE`);
            const [session] = await tx.select().from(sleepSessions).where(and(
              eq(sleepSessions.id, oldRecord.sleepSessionId),
              eq(sleepSessions.familyId, grant.familyId),
              eq(sleepSessions.childId, childId),
              eq(sleepSessions.createdBy, `supporter:${auth.supporter.id}`),
            )).limit(1);
            if (!session) {
              const error: any = new Error("この睡眠記録のセッションを更新する権限がありません。");
              error.status = 403;
              throw error;
            }
            oldSleepDurationMin = session.durationMin;
            await tx.update(sleepSessions).set({
              startedAt: occurredAt,
              endedAt: endsAt,
              durationMin: sleepDurationMin,
            }).where(eq(sleepSessions.id, session.id));
          }
          const [record] = await tx.update(logs).set({
            ...fieldsToLogData(fields),
            ...(input.occurredAt ? { createdAt: occurredAt } : {}),
          } as any).where(eq(logs.id, recordId)).returning();
          const dto = toRecordDto(record, auth.supporter.id, sleepDurationMin);
          await audit(tx, {
            actorAccountId: auth.actor.id, supporterAccountId: auth.supporter.id, supporterGrantId: grant.id,
            action: "update", requestId: input.requestId,
            before: toRecordDto(oldRecord, auth.supporter.id, oldSleepDurationMin), after: { record: dto, reason: input.reason },
          });
          return dto;
        },
      ));
      res.json(result);
    } catch (error) {
      respondError(res, error);
    }
  });

  app.delete("/api/supporter/children/:childId/records/:recordId", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    try {
      const childId = Number(req.params.childId);
      const recordId = Number(req.params.recordId);
      const input = zDeleteSchema.parse(req.body);
      const result = await db.transaction(async (tx) => idempotentRecord(
        tx, auth.supporter.id, "delete", input.requestId, { childId, recordId, ...input },
        async () => {
          const activePeriods = await lockedActiveGrantsForChild(tx, auth.supporter.id, childId);
          requireActiveGrant(activePeriods.find((candidate) => candidate.id === input.grantId));
        },
        async () => {
          const activePeriods = await lockedActiveGrantsForChild(tx, auth.supporter.id, childId);
          const grant = requireActiveGrant(activePeriods.find((candidate) => candidate.id === input.grantId));
          await tx.execute(sql`SELECT id FROM logs WHERE id = ${recordId} FOR UPDATE`);
          const [oldRecord] = await tx.select().from(logs).where(and(
            eq(logs.id, recordId), eq(logs.childId, childId), eq(logs.supporterAccountId, auth.supporter.id), isNull(logs.deletedAt),
          )).limit(1);
          if (!oldRecord || !isWithinGrantPeriod(new Date(oldRecord.createdAt!), activePeriods)) {
            const error: any = new Error("自分が入力した利用可能期間内の記録のみ削除できます。");
            error.status = 403;
            throw error;
          }
          if (oldRecord.type === "sleep") {
            if (!oldRecord.sleepSessionId) {
              const error: any = new Error("この睡眠記録には削除可能な睡眠セッションがありません。");
              error.status = 409;
              throw error;
            }
            await tx.execute(sql`SELECT id FROM sleep_sessions WHERE id = ${oldRecord.sleepSessionId} FOR UPDATE`);
            const [session] = await tx.select().from(sleepSessions).where(and(
              eq(sleepSessions.id, oldRecord.sleepSessionId),
              eq(sleepSessions.familyId, grant.familyId),
              eq(sleepSessions.childId, childId),
              eq(sleepSessions.createdBy, `supporter:${auth.supporter.id}`),
            )).limit(1);
            if (!session) {
              const error: any = new Error("この睡眠記録のセッションを削除する権限がありません。");
              error.status = 403;
              throw error;
            }
            await tx.delete(sleepSessions).where(eq(sleepSessions.id, session.id));
          }
          const [record] = await tx.update(logs).set({ deletedAt: new Date() }).where(eq(logs.id, recordId)).returning();
          const response = { id: record.id, deleted: true };
          await audit(tx, {
            actorAccountId: auth.actor.id, supporterAccountId: auth.supporter.id, supporterGrantId: grant.id,
            action: "delete", requestId: input.requestId,
            before: toRecordDto(oldRecord, auth.supporter.id), after: { ...response, reason: input.reason },
          });
          return response;
        },
      ));
      res.json(result);
    } catch (error) {
      respondError(res, error);
    }
  });

  app.post("/api/supporter/children/:childId/export", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    try {
      const childId = Number(req.params.childId);
      const input = supporterExportSchema.parse(req.body);
      const payload = await db.transaction(async (tx) => {
        // A revoke waits on these locks; re-checking active grants inside this
        // transaction prevents a concurrent revoke from authorising export.
        await lockedActiveGrantsForChild(tx, auth.supporter.id, childId);
        const result = await recordResponse(auth.supporter, childId, input.grantIds, tx);
        await audit(tx, {
          actorAccountId: auth.actor.id, supporterAccountId: auth.supporter.id,
          action: "export", after: { childId, grantIds: input.grantIds },
        });
        return result;
      });
      res.json({
        ...payload,
        facilityName: auth.supporter.displayName,
        exportedAt: new Date().toISOString(),
        periods: payload.grants.filter((grant) => input.grantIds.includes(grant.id)),
      });
    } catch (error) {
      respondError(res, error);
    }
  });

  app.get("/api/supporter/manage", async (req, res) => {
    const actor = await requireParent(req, res);
    if (!actor) return;
    const families = await verifiedParentFamilies(actor.id);
    const childRows = families.length ? await db.select().from(children).where(inArray(children.familyId, families)) : [];
    const grants = families.length ? await db.select().from(supporterGrants).where(inArray(supporterGrants.familyId, families)) : [];
    const accounts = await db.select().from(supporterAccounts);
    const byChild = new Map(childRows.map((child) => [child.id, child]));
    const byAccount = new Map(accounts.map((account) => [account.id, account]));
    // Do not surface a grant whose denormalized family_id disagrees with its
    // child.  Such a row cannot authorize supporter access and must not become
    // manageable merely because its family_id matches the parent's family.
    const ownedGrants = grants.filter((grant) => byChild.get(grant.childId)?.familyId === grant.familyId);
    res.json({
      children: childRows.map((child) => ({ id: child.id, name: child.name, birthday: child.birthday })),
      invitations: ownedGrants.map((grant) => ({
        id: grant.id, childId: grant.childId, childName: byChild.get(grant.childId)?.name || "",
        recipientAddress: byAccount.get(grant.supporterAccountId)?.inviteAddress || "",
        displayName: byAccount.get(grant.supporterAccountId)?.displayName || "",
        startsAt: iso(grant.startsAt), endsAt: iso(grant.endsAt),
        acceptedAt: grant.acceptedAt ? iso(grant.acceptedAt) : null, revokedAt: grant.revokedAt ? iso(grant.revokedAt) : null,
      })),
    });
  });

  app.post("/api/supporter/invitations", async (req, res) => {
    const actor = await requireParent(req, res);
    if (!actor) return;
    try {
      const input = supporterInvitationSchema.parse(req.body);
      const families = await verifiedParentFamilies(actor.id);
      const [child] = await db.select().from(children).where(and(
        eq(children.id, input.childId), inArray(children.familyId, families),
      )).limit(1);
      const [account] = await db.select().from(supporterAccounts).where(and(
        eq(supporterAccounts.inviteAddress, input.recipientAddress),
        eq(supporterAccounts.isActive, true),
        isNotNull(supporterAccounts.userId),
      )).limit(1);
      if (!child || !account) {
        return res.status(400).json({ message: "対象のお子さままたは確認済みの招待先アカウントが見つかりません。" });
      }
      if (input.displayName && input.displayName !== account.displayName) {
        return res.status(400).json({ message: "招待先アカウントの表示名が確認済みの情報と一致しません。" });
      }
      const grant = await db.transaction(async (tx) => {
        const [created] = await tx.insert(supporterGrants).values({
          familyId: child.familyId, childId: child.id, supporterAccountId: account.id,
          invitedByUserId: actor.id, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt),
        }).returning();
        await audit(tx, { actorAccountId: actor.id, supporterAccountId: account.id, supporterGrantId: created.id, action: "invite", after: input });
        return created;
      });
      res.status(201).json({ id: grant.id, childId: grant.childId, recipientAddress: account.inviteAddress, displayName: account.displayName, startsAt: iso(grant.startsAt), endsAt: iso(grant.endsAt), acceptedAt: null, revokedAt: null });
    } catch (error) {
      respondError(res, error);
    }
  });

  app.get("/api/supporter/invitations", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    const grants = await db.select().from(supporterGrants).where(eq(supporterGrants.supporterAccountId, auth.supporter.id));
    const ids = Array.from(new Set(grants.map((grant) => grant.childId)));
    const childRows = ids.length ? await db.select().from(children).where(inArray(children.id, ids)) : [];
    const byChild = new Map(childRows.map((child) => [child.id, child]));
    const ownedGrants = grants.filter((grant) => byChild.get(grant.childId)?.familyId === grant.familyId);
    res.json({ invitations: ownedGrants.map((grant) => ({
      id: grant.id, childId: grant.childId, childName: byChild.get(grant.childId)?.name || "",
      recipientAddress: auth.supporter.inviteAddress, displayName: auth.supporter.displayName,
      startsAt: iso(grant.startsAt), endsAt: iso(grant.endsAt),
      acceptedAt: grant.acceptedAt ? iso(grant.acceptedAt) : null, revokedAt: grant.revokedAt ? iso(grant.revokedAt) : null,
    })) });
  });

  app.post("/api/supporter/invitations/:id/accept", async (req, res) => {
    const auth = await requireSupporter(req, res);
    if (!auth) return;
    try {
      const id = Number(req.params.id);
      const grant = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM supporter_grants WHERE id = ${id} FOR UPDATE`);
        const [current] = await tx.select().from(supporterGrants).where(and(
          eq(supporterGrants.id, id), eq(supporterGrants.supporterAccountId, auth.supporter.id),
        )).limit(1);
        if (!current || current.revokedAt || current.endsAt <= new Date()) {
          const error: any = new Error("この招待は受諾できません。");
          error.status = 403;
          throw error;
        }
        const [child] = await tx.select({ id: children.id }).from(children).where(and(
          eq(children.id, current.childId),
          eq(children.familyId, current.familyId),
        )).limit(1);
        if (!child) {
          const error: any = new Error("この招待の対象を確認できません。");
          error.status = 403;
          throw error;
        }
        if (current.acceptedAt) return current;
        const [accepted] = await tx.update(supporterGrants).set({ acceptedAt: new Date() }).where(eq(supporterGrants.id, id)).returning();
        await audit(tx, { actorAccountId: auth.actor.id, supporterAccountId: auth.supporter.id, supporterGrantId: id, action: "accept", before: current, after: accepted });
        return accepted;
      });
      res.json({ id: grant.id, acceptedAt: grant.acceptedAt ? iso(grant.acceptedAt) : null });
    } catch (error) {
      respondError(res, error);
    }
  });

  app.patch("/api/supporter/invitations/:id", async (req, res) => {
    const actor = await requireParent(req, res);
    if (!actor) return;
    try {
      const id = Number(req.params.id);
      const input = supporterGrantExtensionSchema.parse(req.body);
      const families = await verifiedParentFamilies(actor.id);
      const grant = await db.transaction(async (tx) => {
        const current = await lockedParentGrant(tx, id, families);
        if (!current || current.revokedAt || new Date(input.endsAt) <= current.endsAt) {
          const error: any = new Error("この招待は延長できません。");
          error.status = 403;
          throw error;
        }
        const [updated] = await tx.update(supporterGrants).set({ endsAt: new Date(input.endsAt) }).where(eq(supporterGrants.id, id)).returning();
        await audit(tx, { actorAccountId: actor.id, supporterAccountId: current.supporterAccountId, supporterGrantId: id, action: "extend", before: current, after: updated });
        return updated;
      });
      res.json({ id: grant.id, startsAt: iso(grant.startsAt), endsAt: iso(grant.endsAt) });
    } catch (error) {
      respondError(res, error);
    }
  });

  app.post("/api/supporter/invitations/:id/revoke", async (req, res) => {
    const actor = await requireParent(req, res);
    if (!actor) return;
    try {
      const id = Number(req.params.id);
      const families = await verifiedParentFamilies(actor.id);
      const grant = await db.transaction(async (tx) => {
        const current = await lockedParentGrant(tx, id, families);
        if (!current) {
          const error: any = new Error("この招待を取り消す権限がありません。");
          error.status = 403;
          throw error;
        }
        if (current.revokedAt) return current;
        const [updated] = await tx.update(supporterGrants).set({ revokedAt: new Date() }).where(eq(supporterGrants.id, id)).returning();
        await audit(tx, { actorAccountId: actor.id, supporterAccountId: current.supporterAccountId, supporterGrantId: id, action: "revoke", before: current, after: updated });
        return updated;
      });
      res.json({ id: grant.id, revokedAt: grant.revokedAt ? iso(grant.revokedAt) : null });
    } catch (error) {
      respondError(res, error);
    }
  });
}

const zDeleteSchema = supporterRecordPatchSchema.pick({ grantId: true, requestId: true, reason: true });

/**
 * Mount after express.json and session middleware, before legacy routes.
 * It is intentionally a no-op while the feature is not safely enabled.
 */
export async function supporterLegacyGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();
  // verify-code also joins a family (invitation-code flow), so it is sealed
  // for supporter accounts together with the explicit family/role mutations.
  const authRoleMutation = ["/api/auth/join-family", "/api/auth/update-role", "/api/auth/verify-code"].includes(req.path);
  // Keep the legacy role/family mutation sealed for a mapped supporter even
  // when production feature gating is not ready. With the flag unset we do
  // not touch additive tables, preserving pre-migration compatibility.
  if (authRoleMutation && process.env.SUPPORTER_ACCESS_ENABLED === "true") {
    const authActor = await getActor(req);
    if (authActor) {
      try {
        if (await getSupporter(authActor.id)) {
          return res.status(403).json({ message: "サポーターアカウントでは家族参加や役割変更はできません。" });
        }
      } catch {
        // Authentication entry/logout stay available, but a failed permission
        // lookup must never authorize a family/role mutation.
        return res.status(503).json({ message: "権限を確認できないため変更できません。管理者にお問い合わせください。" });
      }
    }
  }
  if (!supporterFeatureEnabled()) return next();
  if (req.path.startsWith("/api/supporter/")) return next();
  // Admin authorization is deliberately independent of a session and parent
  // membership. Only this exact route/method allowlist may use x-admin-key;
  // it is never a prefix-based bypass for other legacy APIs.
  if (isKnownAdminRoute(req.method, req.path)) {
    if (!isVerifiedAdminRequest(req)) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    return next();
  }
  const actor = await getActor(req);
  if (req.path.startsWith("/api/auth/")) {
    // Auth is an explicit allowlist, not a prefix exception. In strict mode
    // neither an anonymous request nor a supporter account may use legacy
    // code verification to gain a different authority path.
    //
    // Each entry is a verified login/identity route that actually exists in
    // THIS app's server/auth.ts, registered with its real HTTP method
    // (handoff §1: never allow /api/auth/* wholesale). Family/role mutation
    // routes (verify-code, join-family, update-role, generate-invite) are
    // deliberately absent: after migration, parent authority comes from
    // admin-verified parent_access rows, not self-declared familyId.
    const allowed = ({
      GET: [
        "/api/auth/me",
        // LINE Login (web session + mobile deep-link redirect)
        "/api/auth/line",
        "/api/auth/line/callback",
        // Google Login (server-side redirect flow for native apps)
        "/api/auth/google/native",
        "/api/auth/google/callback",
      ],
      POST: [
        "/api/auth/logout",
        "/api/auth/mobile/logout",
        // Google Login (mobile token exchange — server verifies the token)
        "/api/auth/google",
        // Apple Login (mobile identityToken verification)
        "/api/auth/apple",
        // Own-account operations with no family/role mutation:
        "/api/auth/push-token",
        "/api/auth/delete-account", // store-policy requirement; FK RESTRICT protects supporter/parent-linked users
      ],
    } as Record<string, string[]>)[req.method] ?? [];
    if (allowed.includes(req.path)) return next();
    return res.status(actor ? 403 : 401).json({
      message: "この認証操作はサポーター権限が有効な間は利用できません。",
    });
  }
  if (!actor) return res.status(401).json({ message: "サポーター権限が有効な間はログインが必要です。" });
  const families = await verifiedParentFamilies(actor.id);
  if (families.length === 0) {
    return res.status(403).json({ message: "確認済みのパパ・ママ権限が必要です。サポーター専用アカウントは既存APIを利用できません。" });
  }
  // Own-account health endpoints have no family bearer value. A verified
  // parent may access only their own account, never a supplied other userId.
  if (req.path === "/api/mama-health-logs" || req.path === "/api/mama-health-logs/today") {
    const suppliedUserId = req.body?.userId ?? req.query.userId;
    if (suppliedUserId !== undefined && String(suppliedUserId) !== String(actor.id)) {
      return res.status(403).json({ message: "自分自身の健康記録のみ操作できます。" });
    }
    return next();
  }
  if (req.path === "/api/diaries" || /^\/api\/diaries\/\d+$/.test(req.path)) {
    const suppliedUserId = req.body?.userId ?? req.query.userId;
    if (String(suppliedUserId ?? "") !== String(actor.id)) {
      return res.status(403).json({ message: "日記は確認済みログイン本人の userId でのみ操作できます。" });
    }
  }
  if (!isKnownLegacyDataRoute(req.method, req.path)) {
    return res.status(403).json({ message: "未確認の既存APIへのアクセスは許可されていません。" });
  }
  const pathFamily = familyFromKnownLegacyPath(req.method, req.path);
  const sources = [pathFamily, req.query.familyId, req.body?.familyId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  if (sources.length === 0 || sources.some((value) => value !== sources[0])) {
    return res.status(403).json({ message: "既存APIへのアクセスは確認済み家族IDを明示して一致させる必要があります。" });
  }
  if (!families.includes(sources[0])) {
    return res.status(403).json({ message: "この家族への確認済みアクセス権がありません。" });
  }
  return next();
}