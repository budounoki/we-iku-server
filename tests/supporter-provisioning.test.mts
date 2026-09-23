/**
 * Development-DB integration coverage for admin-only supporter provisioning.
 *
 * This suite mounts only the additive provisioning module, so the production
 * route wiring and the legacy strict guard can be tested independently. It
 * uses random fixture identifiers and removes every inserted row on exit.
 */
import "./safety/require-managed.mjs";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.ts";
import { registerSupporterProvisioningRoutes } from "../server/supporter-provisioning.ts";
import { supporterLegacyGuard } from "../server/supporter.ts";

const tag = `supporter-provisioning-${randomUUID()}`;
const family = `${tag}-family`;
const otherFamily = `${tag}-other-family`;
let firstUser = 0;
let secondUser = 0;
let firstAccount = 0;

async function query<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, values)).rows as T[];
}

const app = express();
app.use(express.json());
app.use(supporterLegacyGuard);
registerSupporterProvisioningRoutes(app);
const server = createServer(app);

async function startServer() {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function request(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  adminKey?: string,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(adminKey ? { "x-admin-key": adminKey } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function seedUsers() {
  const rows = await query<{ id: number }>(
    `INSERT INTO users (line_user_id, display_name, family_id, role)
     VALUES ($1, $2, $3, 'papa'), ($4, $5, $6, 'mama')
     RETURNING id`,
    [`${tag}-first-line`, "Provisioning First", family, `${tag}-second-line`, "Provisioning Second", otherFamily],
  );
  [firstUser, secondUser] = rows.map((row) => row.id);
}

async function main() {
  await seedUsers();
  const base = await startServer();
  const validKey = process.env.ADMIN_KEY;

  assert.equal((await request(base, "GET", "/api/admin/supporter/accounts")).status, 403, "missing key is denied");
  assert.equal((await request(base, "GET", "/api/admin/supporter/accounts", undefined, "wrong-key")).status, 403, "invalid key is denied");
  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/accounts", {
      userId: 999_999_999, publicCode: `${tag}-missing`, kind: "facility",
    }, validKey)).status,
    404,
    "linking never creates a user",
  );
  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/accounts", {
      userId: firstUser, publicCode: `${tag}-strict`, kind: "facility", unexpected: "rejected",
    }, validKey)).status,
    400,
    "account input is strict",
  );

  const publicCode = `${tag}-facility`;
  const created = await request(base, "POST", "/api/admin/supporter/accounts", {
    userId: firstUser, publicCode, kind: "facility",
  }, validKey);
  assert.equal(created.status, 201);
  firstAccount = created.body.id;
  assert.equal(created.body.displayName, "ぶどうの木");
  assert.equal(
    (await query<{ invite_address: string }>(
      "SELECT invite_address FROM supporter_accounts WHERE id = $1", [firstAccount],
    ))[0].invite_address,
    publicCode,
  );

  const retry = await request(base, "POST", "/api/admin/supporter/accounts", {
    userId: firstUser, publicCode, kind: "facility",
  }, validKey);
  assert.equal(retry.status, 200, "retry updates the same account instead of creating another");
  assert.equal(
    (await query("SELECT id FROM supporter_accounts WHERE user_id = $1", [firstUser])).length,
    1,
  );

  const listed = await request(base, "GET", "/api/admin/supporter/accounts", undefined, validKey);
  assert.equal(listed.status, 200);
  const listedAccount = listed.body.accounts.find((account: any) => account.id === firstAccount);
  assert.equal(listedAccount.publicCode, publicCode);
  assert.equal(Object.hasOwn(listedAccount, "lineUserId"), false);
  assert.equal(Object.hasOwn(listedAccount, "email"), false);
  assert.equal(Object.hasOwn(listedAccount, "inviteAddress"), false);

  const updated = await request(base, "POST", "/api/admin/supporter/accounts", {
    userId: firstUser, publicCode, displayName: "確認済み施設", kind: "sitter",
  }, validKey);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.displayName, "確認済み施設");
  assert.equal(updated.body.kind, "sitter");
  const accountAudit = await query<{ before: any; after: any; action: string }>(
    "SELECT action, before, after FROM supporter_audit_logs WHERE supporter_account_id = $1 ORDER BY id DESC LIMIT 1",
    [firstAccount],
  );
  assert.equal(accountAudit[0].action, "admin_link_account");
  assert.equal(accountAudit[0].before.displayName, "ぶどうの木");
  assert.equal(accountAudit[0].after.displayName, "確認済み施設");

  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/accounts", {
      userId: secondUser, publicCode, kind: "facility",
    }, validKey)).status,
    409,
    "a public code cannot be reassigned to another user",
  );
  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/accounts", {
      userId: firstUser, publicCode: `${tag}-second-code`, kind: "relative",
    }, validKey)).status,
    409,
    "a user cannot be reassigned to another account",
  );

  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/parents", {
      userId: firstUser, familyId: family, role: "papa", verificationConfirmed: false, reason: "not confirmed",
    }, validKey)).status,
    400,
    "parent access requires explicit confirmation",
  );
  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/parents", {
      userId: firstUser, familyId: otherFamily, role: "papa", verificationConfirmed: true, reason: "wrong family",
    }, validKey)).status,
    403,
    "parent access checks the current family",
  );
  assert.equal(
    (await request(base, "POST", "/api/admin/supporter/parents", {
      userId: firstUser, familyId: family, role: "mama", verificationConfirmed: true, reason: "wrong role",
    }, validKey)).status,
    403,
    "parent access checks the current role",
  );
  const parent = await request(base, "POST", "/api/admin/supporter/parents", {
    userId: firstUser, familyId: family, role: "papa", verificationConfirmed: true, reason: "admin reviewed existing account",
  }, validKey);
  assert.equal(parent.status, 200);
  const parentRetry = await request(base, "POST", "/api/admin/supporter/parents", {
    userId: firstUser, familyId: family, role: "papa", verificationConfirmed: true, reason: "admin reviewed existing account",
  }, validKey);
  assert.equal(parentRetry.status, 200, "parent retry is an upsert, not a duplicate membership");
  assert.equal(
    (await query("SELECT id FROM parent_access WHERE user_id = $1 AND family_id = $2", [firstUser, family])).length,
    1,
  );
  const unchangedUser = await query<{ family_id: string; role: string }>(
    "SELECT family_id, role FROM users WHERE id = $1", [firstUser],
  );
  assert.deepEqual(unchangedUser[0], { family_id: family, role: "papa" });
  const parentAudit = await query<{ after: any }>(
    "SELECT after FROM supporter_audit_logs WHERE action = 'admin_verify_parent' AND after->>'userId' = $1 ORDER BY id DESC LIMIT 1",
    [String(firstUser)],
  );
  assert.equal(parentAudit[0].after.reason, "admin reviewed existing account");

  process.env.SUPPORTER_ACCESS_ENABLED = "false";
  assert.equal(
    (await request(base, "GET", "/api/admin/supporter/accounts", undefined, "wrong-key")).status,
    403,
    "the admin guard remains first while disabled",
  );
  assert.equal(
    (await request(base, "GET", "/api/admin/supporter/accounts", undefined, validKey)).status,
    503,
    "valid admin requests report the disabled feature",
  );
  process.env.SUPPORTER_ACCESS_ENABLED = "true";

  console.log("supporter provisioning tests passed");
}

async function cleanup() {
  await query(
    `DELETE FROM supporter_audit_logs
     WHERE supporter_account_id IN (SELECT id FROM supporter_accounts WHERE public_code LIKE $1)
        OR after->>'familyId' IN ($2, $3)`,
    [`${tag}%`, family, otherFamily],
  );
  await query("DELETE FROM parent_access WHERE user_id IN ($1, $2)", [firstUser, secondUser]);
  await query("DELETE FROM supporter_accounts WHERE public_code LIKE $1", [`${tag}%`]);
  await query("DELETE FROM users WHERE id IN ($1, $2)", [firstUser, secondUser]);
}

try {
  await main();
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
  await pool.end();
}
