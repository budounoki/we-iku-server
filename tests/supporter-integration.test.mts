/**
 * Development-DB integration coverage for supporter access.
 *
 * This intentionally starts an isolated, ephemeral Express server. The
 * x-supporter-test-actor header is translated into req.session only here; it
 * is not part of production middleware or any shipped route.
 *
 * Run only through the managed integration group after
 * docs/supporter-development-schema.sql has been applied:
 *   node tests/run-managed-tests.mjs supporter
 */
import "./safety/require-managed.mjs";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.ts";
import { registerSupporterRoutes, supporterLegacyGuard } from "../server/supporter.ts";

const tag = `supporter-it-${randomUUID()}`;
const familyA = `${tag}-family-a`;
const familyB = `${tag}-family-b`;
const now = new Date();
const iso = (date: Date) => date.toISOString();
const activeStart = new Date(now.getTime() - 3 * 60 * 60_000);
const activeEnd = new Date(now.getTime() + 3 * 60 * 60_000);
const oldStart = new Date(now.getTime() - 8 * 60 * 60_000);
const oldEnd = new Date(now.getTime() - 4 * 60 * 60_000);

let parentA = 0;
let parentB = 0;
let supporterUser = 0;
let otherSupporterUser = 0;
let supporterAccount = 0;
let otherSupporterAccount = 0;
let mixedSupporterAccount = 0;
let unboundSupporterAccount = 0;
let childA = 0;
let childB = 0;
let childWithoutGrant = 0;
let activeGrant = 0;
let overlapGrant = 0;
let expiredGrant = 0;
let otherActiveGrant = 0;
let mixedGrant = 0;
let pendingGrant = 0;

async function query<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, values)).rows as T[];
}

async function seed() {
  const users = await query<{ id: number }>(
    `INSERT INTO users (line_user_id, display_name, family_id, role)
     VALUES ($1, $2, $3, 'mama'), ($4, $5, $6, 'papa'),
            ($7, $8, $9, 'papa'), ($10, $11, $12, 'papa')
     RETURNING id`,
    [
      `${tag}-parent-a`, "Parent A", familyA,
      `${tag}-parent-b`, "Parent B", familyB,
      `${tag}-supporter`, "Supporter Login", `${tag}-unrelated`,
      `${tag}-supporter-other`, "Other Supporter", `${tag}-unrelated-2`,
    ],
  );
  [parentA, parentB, supporterUser, otherSupporterUser] = users.map((row) => row.id);
  await query(
    `INSERT INTO parent_access (user_id, family_id, role, verified_at)
     VALUES ($1, $2, 'mama', now()), ($3, $4, 'papa', now())`,
    [parentA, familyA, parentB, familyB],
  );
  const accounts = await query<{ id: number }>(
    `INSERT INTO supporter_accounts (user_id, invite_address, public_code, display_name, kind)
     VALUES ($1, $2, $3, 'ぶどうの木', 'facility'),
            ($4, $5, $6, '祖父母', 'relative'),
            ($7, $8, $9, 'ぶどうの木（親）', 'facility'),
            ($10, $11, $12, '未連携アカウント', 'facility')
     RETURNING id`,
    [
      supporterUser, `${tag}@facility.invalid`, `${tag}-facility`,
      otherSupporterUser, `${tag}-other@facility.invalid`, `${tag}-other`,
      parentA, `${tag}-mixed@facility.invalid`, `${tag}-mixed`,
      null, `${tag}-unbound@facility.invalid`, `${tag}-unbound`,
    ],
  );
  [supporterAccount, otherSupporterAccount, mixedSupporterAccount, unboundSupporterAccount] = accounts.map((row) => row.id);
  const seededChildren = await query<{ id: number }>(
    `INSERT INTO children (family_id, name, birthday)
     VALUES ($1, 'テスト児A', '2025-01-01'), ($2, 'テスト児B', '2025-02-01'),
            ($1, '招待なし児', '2025-03-01')
     RETURNING id`,
    [familyA, familyB],
  );
  [childA, childB, childWithoutGrant] = seededChildren.map((row) => row.id);
  const grants = await query<{ id: number }>(
    `INSERT INTO supporter_grants
      (family_id, child_id, supporter_account_id, invited_by_user_id, starts_at, ends_at, accepted_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, now()),
      ($1, $2, $3, $4, $7, $8, now()),
      ($1, $2, $3, $4, $9, $10, now()),
       ($1, $2, $11, $4, $5, $6, now()),
       ($1, $2, $12, $4, $5, $6, now()),
       ($1, $2, $3, $4, $5, $6, NULL)
     RETURNING id`,
    [
      familyA, childA, supporterAccount, parentA, activeStart, activeEnd,
      new Date(now.getTime() - 60 * 60_000), new Date(now.getTime() + 60 * 60_000),
      oldStart, oldEnd, otherSupporterAccount, mixedSupporterAccount,
    ],
  );
  [activeGrant, overlapGrant, expiredGrant, otherActiveGrant, mixedGrant, pendingGrant] = grants.map((row) => row.id);

  // One current daily entry, one historical daily entry and safe historical
  // exception records. The malicious milk row verifies DTO projection is not
  // based on incidental populated columns.
  await query(
    `INSERT INTO logs
      (family_id, child_id, user_id, type, points, created_at, message, formula_ml, medicine_name, medicine_dose)
     VALUES
      ($1, $2, 'mama', 'milk', 10, $3, 'current milk', 120, 'PRIVATE', 'PRIVATE'),
      ($1, $2, 'mama', 'medicine', 10, $4, 'old medicine', NULL, 'PRIVATE', 'PRIVATE'),
      ($1, $2, 'mama', 'allergy_report', 10, $4, 'historic allergy report', NULL, NULL, NULL),
      ($1, $2, 'mama', 'handoff_note', 10, $4, 'historic handoff note', NULL, NULL, NULL),
      ($1, $2, 'mama', 'allergy_report', 10, $5, 'future history', NULL, NULL, NULL)`,
    [
      familyA, childA, new Date(now.getTime() - 30 * 60_000),
      new Date(now.getTime() - 6 * 60 * 60_000), new Date(now.getTime() + 60 * 60_000),
    ],
  );
  await query(
    `INSERT INTO health_records (family_id, child_id, type, title, detail, recorded_at)
     VALUES ($1, $2, 'allergy', 'allergy', '保護者のアレルギー申告', NULL),
            ($1, $2, 'health_note', 'handoff', 'お預かり注意事項', NULL),
            ($1, NULL, 'allergy', 'unbound', 'must not appear', NULL),
            ($1, $3, 'allergy', 'denied', '招待なしの履歴', NULL)`,
    [familyA, childA, childWithoutGrant],
  );
}

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  // Test-only session adapter. This source file is never imported by server
  // startup, and production has no matching header behavior.
  const raw = req.header("x-supporter-test-actor");
  const provider = req.header("x-supporter-test-provider");
  // The provider label is deliberately opaque to supporter authorization:
  // the session's common users.id is the only identity input.  This exercises
  // a provider-independent session without claiming that a real Google/Apple
  // login is wired in this repository.
  (req as any).session = raw
    ? {
        // One synthetic adapter serializes the common id as a string, as an
        // external provider adapter may do. The server must still resolve the
        // existing users row, not infer a provider or create an identity.
        userId: provider === "google" ? String(Number(raw)) : Number(raw),
        ...(provider ? { provider } : {}),
      }
    : {};
  next();
});
app.use(supporterLegacyGuard);
registerSupporterRoutes(app);
// Dummy handlers validate guard decisions without querying live admin or
// family-migration data.
app.get("/api/family/id-status", (_req, res) => res.json({ ok: true }));
app.post("/api/family/rotate-id", (_req, res) => res.json({ ok: true }));
app.get("/api/admin/stats", (_req, res) => res.json({ ok: true }));
app.get("/api/logs/:familyId", (req, res) => res.json({ familyId: req.params.familyId }));
app.post("/api/logs/:id/update", (_req, res) => res.json({ ok: true }));
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ message: "unexpected integration harness error" });
});
const server = createServer(app);

async function startServer() {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function main() {
  await seed();
  const base = await startServer();
  async function request(
    method: string,
    path: string,
    actor?: number,
    body?: unknown,
    adminKey?: string,
    provider?: string,
  ): Promise<{ status: number; body: any }> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(actor ? { "x-supporter-test-actor": String(actor) } : {}),
        ...(provider ? { "x-supporter-test-provider": provider } : {}),
        ...(adminKey ? { "x-admin-key": adminKey } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }

  const noSession = await request("GET", "/api/logs/" + familyA);
  assert.equal(noSession.status, 401, "legacy data routes require a real session when strict mode is active");
  assert.equal((await request("POST", "/api/auth/verify-code")).status, 401);
  assert.equal((await request("POST", "/api/auth/verify-code", supporterUser)).status, 403);
  assert.equal((await request("POST", "/api/auth/join-family", supporterUser)).status, 403);
  assert.equal((await request("POST", "/api/auth/update-role", supporterUser)).status, 403);
  assert.equal((await request("GET", `/api/family/id-status?familyId=${familyA}`, parentA)).status, 200);
  assert.equal((await request("POST", "/api/family/rotate-id", parentA, { familyId: familyA })).status, 200);
  assert.equal((await request("GET", `/api/family/id-status?familyId=${familyA}`, supporterUser)).status, 403);
  assert.equal((await request("POST", "/api/family/rotate-id", supporterUser, { familyId: familyA })).status, 403);
  assert.equal((await request("GET", "/api/admin/stats")).status, 403);
  assert.equal((await request("GET", "/api/admin/stats", supporterUser)).status, 403);
  assert.equal((await request("GET", "/api/admin/stats", undefined, undefined, "wrong-key")).status, 403);
  assert.equal(
    (await request("GET", "/api/admin/stats", undefined, undefined, process.env.ADMIN_KEY)).status,
    200,
    "a verified admin key is independent of parent membership",
  );
  assert.equal(
    (await request("GET", `/api/unknown?familyId=${familyA}`, undefined, undefined, process.env.ADMIN_KEY)).status,
    401,
    "an admin key does not bypass non-admin legacy routes",
  );
  assert.equal((await request("GET", `/api/logs/${familyB}?familyId=${familyA}`, parentA)).status, 403);
  assert.equal((await request("GET", `/api/logs/${familyA}`, parentA)).status, 200);
  assert.equal(
    (await request("POST", "/api/logs/987654/update", parentA, { familyId: familyA })).status,
    200,
    "resource ids are not misread as a family id by the legacy guard",
  );
  assert.equal((await request("GET", `/api/unknown?familyId=${familyA}`, parentA)).status, 403, "unknown legacy APIs fail closed");
  assert.equal(
    (await request("GET", `/api/families/${familyA}/unregistered-endpoint`, parentA)).status,
    403,
    "unknown family-prefixed APIs fail closed",
  );
  assert.equal((await request("GET", `/api/logs/${familyA}`, supporterUser)).status, 403, "supporter-only login cannot use legacy APIs");

  const status = await request("GET", "/api/supporter/status", supporterUser);
  assert.deepEqual(
    { enabled: status.body.enabled, authenticated: status.body.authenticated, isSupporter: status.body.isSupporter },
    { enabled: true, authenticated: true, isSupporter: true },
  );
  const mixedStatus = await request("GET", "/api/supporter/status", parentA, undefined, undefined, "google");
  assert.deepEqual(
    {
      authenticated: mixedStatus.body.authenticated,
      canManage: mixedStatus.body.canManage,
      isSupporter: mixedStatus.body.isSupporter,
    },
    { authenticated: true, canManage: true, isSupporter: true },
    "a provider-independent common session may retain both parent and supporter roles",
  );
  assert.equal(
    (await request("GET", "/api/supporter/children", parentA, undefined, undefined, "apple")).status,
    200,
    "mixed parent/supporter access uses the bound account without changing parent authority",
  );
  const mixedReplayBody = {
    grantId: mixedGrant,
    requestId: `${tag}-mixed-expiry-replay`,
    type: "bath",
    occurredAt: iso(new Date(now.getTime() - 5 * 60_000)),
    fields: { message: "must not replay after revoke" },
  };
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, parentA, mixedReplayBody, undefined, "google")).status,
    201,
  );
  assert.equal(
    (await request("POST", `/api/supporter/invitations/${mixedGrant}/revoke`, parentA, undefined, undefined, "google")).status,
    200,
  );
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, parentA, mixedReplayBody, undefined, "google")).status,
    403,
    "an idempotent replay is re-authorized after its grant is revoked",
  );
  assert.equal(
    (await request("GET", "/api/supporter/children", parentA, undefined, undefined, "google")).body.children
      .some((child: any) => child.id === childA),
    false,
    "revoked mixed-role access is removed without affecting the parent role",
  );
  const available = await request("GET", "/api/supporter/children", supporterUser);
  assert.equal(available.status, 200);
  assert.equal(available.body.children.length, 1);
  assert.equal(available.body.children.some((child: any) => child.id === childWithoutGrant), false);
  assert.equal(available.body.children[0].grants.length, 2, "overlapping grants are both represented");

  const records = await request("GET", `/api/supporter/children/${childA}/records`, supporterUser);
  assert.equal(records.status, 200);
  assert.equal(records.body.records.filter((row: any) => row.message === "current milk").length, 1, "overlaps do not duplicate entries");
  assert.equal(records.body.records.some((row: any) => row.message === "old medicine"), false, "expired daily records stay hidden after re-invite");
  assert.equal(records.body.records.some((row: any) => row.message === "historic allergy report"), true);
  assert.equal(records.body.records.some((row: any) => row.message === "future history"), false);
  assert.equal(records.body.records.some((row: any) => row.message === "保護者のアレルギー申告"), true);
  assert.equal(records.body.records.some((row: any) => row.message === "must not appear"), false);
  const maliciousMilk = records.body.records.find((row: any) => row.message === "current milk");
  assert.equal(maliciousMilk.fields.medicineName, undefined, "type-specific DTO projection hides unrelated private fields");
  assert.equal((await request("GET", `/api/supporter/children/${childB}/records`, supporterUser)).status, 403);
  assert.equal(
    (await request("GET", `/api/supporter/children/${childWithoutGrant}/records`, supporterUser)).status,
    403,
    "child basics and historical exception records require at least one active grant",
  );
  const exported = await request("POST", `/api/supporter/children/${childA}/export`, supporterUser, { grantIds: [activeGrant] });
  assert.equal(exported.status, 200);
  assert.equal(exported.body.records.some((row: any) => row.message === "old medicine"), false);
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/export`, supporterUser, { grantIds: [expiredGrant] })).status,
    403,
    "expired grants cannot be selected for export",
  );
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/export`, supporterUser, { grantIds: [pendingGrant] })).status,
    403,
    "unaccepted grants cannot be selected for export",
  );

  const occurredAt = iso(new Date(now.getTime() - 5 * 60_000));
  const createBody = {
    grantId: activeGrant, requestId: `${tag}-formula-create`, type: "formula", occurredAt,
    fields: { formulaMl: 80, message: "formula entry" },
  };
  const created = await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, createBody);
  assert.equal(created.status, 201);
  const replay = await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, createBody);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.id, created.body.id, "same requestId is a durable replay");
  const concurrentBody = {
    grantId: overlapGrant, requestId: `${tag}-concurrent-create`, type: "bath", occurredAt,
    fields: { message: "concurrent retry" },
  };
  const [concurrentOne, concurrentTwo] = await Promise.all([
    request("POST", `/api/supporter/children/${childA}/records`, supporterUser, concurrentBody),
    request("POST", `/api/supporter/children/${childA}/records`, supporterUser, concurrentBody),
  ]);
  assert.equal(concurrentOne.status, 201);
  assert.equal(concurrentTwo.status, 201);
  assert.equal(concurrentOne.body.id, concurrentTwo.body.id);
  assert.equal(
    (await query("SELECT id FROM supporter_audit_logs WHERE request_id = $1", [`${tag}-concurrent-create`])).length,
    1,
    "concurrent retries create one record and one audit entry",
  );
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, {
      ...createBody, fields: { formulaMl: 81, message: "conflict" },
    })).status,
    409,
  );
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, {
      ...createBody, requestId: `${tag}-forbidden-field`, fields: { formulaMl: 80, medicineName: "nope" },
    })).status,
    400,
    "input fields are allowlisted by record type",
  );
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, {
      ...createBody, requestId: `${tag}-future-record`, occurredAt: iso(new Date(Date.now() + 60_000)),
    })).status,
    400,
  );
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, {
      ...createBody, requestId: `${tag}-expired`, grantId: expiredGrant,
    })).status,
    403,
  );

  const [overlapEditOne, overlapEditTwo] = await Promise.all([
    request("PATCH", `/api/supporter/children/${childA}/records/${created.body.id}`, supporterUser, {
      grantId: activeGrant, requestId: `${tag}-overlap-edit-one`, fields: { formulaMl: 81, message: "overlap one" }, reason: "concurrent correction",
    }),
    request("PATCH", `/api/supporter/children/${childA}/records/${created.body.id}`, supporterUser, {
      grantId: overlapGrant, requestId: `${tag}-overlap-edit-two`, fields: { formulaMl: 82, message: "overlap two" }, reason: "concurrent correction",
    }),
  ]);
  assert.equal(overlapEditOne.status, 200);
  assert.equal(overlapEditTwo.status, 200);
  assert.equal(
    (await query("SELECT id FROM supporter_audit_logs WHERE request_id IN ($1, $2)", [`${tag}-overlap-edit-one`, `${tag}-overlap-edit-two`])).length,
    2,
    "overlapping grants serialize record updates and retain both audits",
  );

  const sleepStart = iso(new Date(Date.now() - 2 * 60_000));
  assert.equal(
    (await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, {
      grantId: activeGrant, requestId: `${tag}-future-sleep`, type: "sleep", occurredAt: iso(new Date()),
      fields: { durationMin: 1 },
    })).status,
    403,
    "a sleep session cannot end in the future",
  );
  const sleep = await request("POST", `/api/supporter/children/${childA}/records`, supporterUser, {
    grantId: activeGrant, requestId: `${tag}-sleep`, type: "sleep", occurredAt: sleepStart,
    fields: { durationMin: 1, message: "sleep entry" },
  });
  assert.equal(sleep.status, 201);
  const linked = await query<{ id: number; duration_min: number }>(
    "SELECT id, duration_min FROM sleep_sessions WHERE id = (SELECT sleep_session_id FROM logs WHERE id = $1)",
    [sleep.body.id],
  );
  assert.equal(linked.length, 1);
  assert.equal(linked[0].duration_min, 1);
  assert.equal(
    (await request("PATCH", `/api/supporter/children/${childA}/records/${sleep.body.id}`, otherSupporterUser, {
      grantId: otherActiveGrant, requestId: `${tag}-other-edit`, fields: { durationMin: 1 }, reason: "not mine",
    })).status,
    403,
  );
  const changedSleep = await request("PATCH", `/api/supporter/children/${childA}/records/${sleep.body.id}`, supporterUser, {
    grantId: activeGrant, requestId: `${tag}-sleep-update`, occurredAt: sleepStart, fields: { durationMin: 1 }, reason: "correction",
  });
  assert.equal(changedSleep.status, 200);
  assert.equal(
    (await request("DELETE", `/api/supporter/children/${childA}/records/${sleep.body.id}`, supporterUser, {
      grantId: activeGrant, requestId: `${tag}-sleep-delete`, reason: "entered twice",
    })).status,
    200,
  );
  assert.equal((await query("SELECT id FROM sleep_sessions WHERE id = $1", [linked[0].id])).length, 0, "soft-deleting supporter sleep removes only its linked session");

  const update = await request("PATCH", `/api/supporter/children/${childA}/records/${created.body.id}`, supporterUser, {
    grantId: activeGrant, requestId: `${tag}-formula-update`, fields: { formulaMl: 90, message: "corrected" }, reason: "typo",
  });
  assert.equal(update.status, 200);
  const deleted = await request("DELETE", `/api/supporter/children/${childA}/records/${created.body.id}`, supporterUser, {
    grantId: overlapGrant, requestId: `${tag}-formula-delete`, reason: "duplicate",
  });
  assert.equal(deleted.status, 200);
  assert.equal((await query("SELECT id FROM logs WHERE id = $1 AND deleted_at IS NOT NULL", [created.body.id])).length, 1);
  assert.equal((await query("SELECT id FROM supporter_audit_logs WHERE supporter_account_id = $1 AND action IN ('create','update','delete')", [supporterAccount])).length >= 3, true);

  const manage = await request("GET", "/api/supporter/manage", parentA);
  assert.equal(manage.status, 200);
  assert.equal(manage.body.children.some((child: any) => child.id === childA), true);
  assert.equal(
    (await request("POST", "/api/supporter/invitations", parentB, {
      childId: childA, recipientAddress: `${tag}-other@facility.invalid`, startsAt: iso(activeStart), endsAt: iso(activeEnd),
    })).status,
    400,
  );
  assert.equal(
    (await request("POST", "/api/supporter/invitations", parentA, {
      childId: childA, recipientAddress: `${tag}-unbound@facility.invalid`, startsAt: iso(activeStart), endsAt: iso(activeEnd),
    })).status,
    400,
    "an unbound routing identifier cannot receive an invitation",
  );
  const invited = await request("POST", "/api/supporter/invitations", parentA, {
    childId: childA, recipientAddress: `${tag}-other@facility.invalid`, displayName: "祖父母",
    startsAt: iso(new Date(now.getTime() + 60 * 60_000)), endsAt: iso(new Date(now.getTime() + 2 * 60 * 60_000)),
  });
  assert.equal(invited.status, 201);
  assert.equal(
    (await request("POST", `/api/supporter/invitations/${invited.body.id}/accept`, otherSupporterUser)).status,
    200,
    "only the account pre-bound to the invitation can accept it",
  );
  assert.equal(
    (await request("PATCH", `/api/supporter/invitations/${invited.body.id}`, parentA, {
      endsAt: iso(new Date(now.getTime() + 3 * 60 * 60_000)),
    })).status,
    200,
  );
  assert.equal((await request("POST", `/api/supporter/invitations/${invited.body.id}/revoke`, parentA)).status, 200);

  console.log("supporter integration tests passed");
}

async function cleanup() {
  await query("DELETE FROM supporter_audit_logs WHERE supporter_account_id IN ($1, $2, $3, $4) OR actor_account_id IN ($5, $6, $7, $8)", [supporterAccount, otherSupporterAccount, mixedSupporterAccount, unboundSupporterAccount, parentA, parentB, supporterUser, otherSupporterUser]);
  await query("DELETE FROM supporter_idempotency WHERE supporter_account_id IN ($1, $2, $3, $4)", [supporterAccount, otherSupporterAccount, mixedSupporterAccount, unboundSupporterAccount]);
  await query("DELETE FROM logs WHERE family_id IN ($1, $2)", [familyA, familyB]);
  await query("DELETE FROM sleep_sessions WHERE family_id IN ($1, $2)", [familyA, familyB]);
  await query("DELETE FROM supporter_grants WHERE family_id IN ($1, $2)", [familyA, familyB]);
  await query("DELETE FROM health_records WHERE family_id IN ($1, $2)", [familyA, familyB]);
  await query("DELETE FROM children WHERE family_id IN ($1, $2)", [familyA, familyB]);
  await query("DELETE FROM parent_access WHERE user_id IN ($1, $2)", [parentA, parentB]);
  await query("DELETE FROM supporter_accounts WHERE id IN ($1, $2, $3, $4)", [supporterAccount, otherSupporterAccount, mixedSupporterAccount, unboundSupporterAccount]);
  await query("DELETE FROM users WHERE id IN ($1, $2, $3, $4)", [parentA, parentB, supporterUser, otherSupporterUser]);
}

try {
  await main();
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
  await pool.end();
}