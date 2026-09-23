/**
 * Safe checks for the developer-only supporter workbench.
 *
 * This harness uses express-session's in-memory store intentionally.  It is
 * test-only and is not imported by server startup.  When a configured
 * development database is available, the session route is exercised against
 * the real module; no fixture rows are deleted by this test.
 *
 * Run only through the managed development group against the approved
 * development database:
 *   node tests/run-managed-tests.mjs development
 */
import "./safety/require-managed.mjs";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import express from "express";
import session from "express-session";
import { pool } from "../server/db.ts";
import {
  isSupporterDevelopmentEnabled,
  registerSupporterDevelopmentRoutes,
} from "../server/supporter-development.ts";

const enabledEnvironment = {
  NODE_ENV: "development",
  SUPPORTER_DEV_FIXTURES_ENABLED: "true",
  SUPPORTER_ACCESS_ENABLED: "true",
  SUPPORTER_DEV_DATABASE_NAME: "heliumdb",
} as const;

function assertGate() {
  assert.equal(isSupporterDevelopmentEnabled(enabledEnvironment), true);
  assert.equal(
    isSupporterDevelopmentEnabled(enabledEnvironment, "heliumdb"),
    true,
  );
  assert.equal(
    isSupporterDevelopmentEnabled(enabledEnvironment, "production-db"),
    false,
  );
  for (const key of [
    "NODE_ENV",
    "SUPPORTER_DEV_FIXTURES_ENABLED",
    "SUPPORTER_ACCESS_ENABLED",
    "SUPPORTER_DEV_DATABASE_NAME",
  ] as const) {
    const missing = { ...enabledEnvironment, [key]: undefined };
    assert.equal(isSupporterDevelopmentEnabled(missing), false, `missing ${key}`);
  }
  assert.equal(
    isSupporterDevelopmentEnabled({
      ...enabledEnvironment,
      SUPPORTER_DEV_FIXTURES_ENABLED: "false",
    }),
    false,
  );
}

async function main() {
  assertGate();

  const database = (await pool.query("SELECT current_database() AS name")).rows[0]
    ?.name;
  const configuredDatabase = process.env.SUPPORTER_DEV_DATABASE_NAME;
  if (!configuredDatabase || database !== configuredDatabase) {
    console.log(
      "supporter development gate tests passed (configured development database is unavailable)",
    );
    return;
  }

  const app = express();
  app.use(express.json());
  // Normal session middleware, MemoryStore only for this test harness.
  app.use(
    session({
      secret: "supporter-development-test-secret",
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
    }),
  );
  registerSupporterDevelopmentRoutes(app);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const disabledApp = express();
    disabledApp.use(express.json());
    disabledApp.use(
      session({
        secret: "supporter-development-test-secret",
        resave: false,
        saveUninitialized: false,
        store: new session.MemoryStore(),
      }),
    );
    registerSupporterDevelopmentRoutes(disabledApp);
    const disabledServer = createServer(disabledApp);
    disabledServer.listen(0, "127.0.0.1");
    await once(disabledServer, "listening");
    const disabledAddress = disabledServer.address();
    assert(disabledAddress && typeof disabledAddress !== "string");
    const disabledBase = `http://127.0.0.1:${disabledAddress.port}`;
    const originalFlags = {
      node: process.env.NODE_ENV,
      fixture: process.env.SUPPORTER_DEV_FIXTURES_ENABLED,
      access: process.env.SUPPORTER_ACCESS_ENABLED,
      db: process.env.SUPPORTER_DEV_DATABASE_NAME,
    };
    process.env.NODE_ENV = "production";
    const productionResponse = await fetch(
      `${disabledBase}/api/supporter/development/status`,
    );
    assert.equal(productionResponse.status, 404);
    process.env.NODE_ENV = originalFlags.node;
    process.env.SUPPORTER_DEV_FIXTURES_ENABLED = originalFlags.fixture;
    process.env.SUPPORTER_ACCESS_ENABLED = originalFlags.access;
    process.env.SUPPORTER_DEV_DATABASE_NAME = originalFlags.db;
    await new Promise<void>((resolve) => disabledServer.close(() => resolve()));

    const status = await fetch(`${base}/api/supporter/development/status`);
    assert.equal(status.status, 200);
    assert.equal((await status.json()).enabled, true);

    const unknownField = await fetch(
      `${base}/api/supporter/development/session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona: "parent", userId: 123 }),
      },
    );
    assert.equal(unknownField.status, 400);

    const crossOrigin = await fetch(
      `${base}/api/supporter/development/session`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://example.invalid",
        },
        body: JSON.stringify({ persona: "parent" }),
      },
    );
    assert.equal(crossOrigin.status, 403);

    const entered = await fetch(
      `${base}/api/supporter/development/session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona: "parent" }),
        redirect: "manual",
      },
    );
    assert.equal(entered.status, 303);
    assert.equal(entered.headers.get("location"), "/supporter/manage");
    const cookie = entered.headers.get("set-cookie");
    assert(cookie, "session cookie should come from normal express-session");
    const after = await fetch(`${base}/api/supporter/development/status`, {
      headers: { cookie: cookie.split(";")[0] },
    });
    const afterBody = await after.json();
    assert.equal(after.status, 200);
    assert.equal(afterBody.session.persona, "parent");

    console.log("supporter development tests passed");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});