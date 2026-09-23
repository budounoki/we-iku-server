import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateTestConfiguration,
  databaseTargetFingerprint,
  buildChildEnvironment,
  validateChildOverrides,
  assertEphemeralCallerEnvironment,
  assertOwnedEphemeralLayout,
  buildEphemeralChildEnvironment,
  cleanupDecision,
  interruptionPlan,
  isOwnedEphemeralDirectory,
} from "./safety/policy.mjs";

// Fictional strings only. No live environment is read.
const url = "postgresql://fixture:synthetic-password@isolated.invalid:5432/fixture_store";
const configured = () => ({
  TEST_DATABASE_URL: url,
  TEST_DATABASE_APPROVED_SHA256: databaseTargetFingerprint(url),
});

test("ordinary DATABASE_URL is never a test fallback", () => {
  assert.throws(() => validateTestConfiguration({ DATABASE_URL: url }), /TEST_DATABASE_URL_REQUIRED/);
  assert.throws(() => validateTestConfiguration({ TEST_DATABASE_URL: "" }), /TEST_DATABASE_URL_REQUIRED/);
});

test("a database named test is not sufficient approval", () => {
  assert.throws(() => validateTestConfiguration({
    TEST_DATABASE_URL: "postgresql://fixture:fake@isolated.invalid/test",
  }), /EXPLICIT_DATABASE_APPROVAL_REQUIRED/);
});

test("explicit approval binds host, port, database, user and TLS mode", () => {
  for (const changed of [
    url.replace("isolated.invalid", "different.invalid"),
    url.replace("5432", "5433"),
    url.replace("fixture_store", "other_store"),
    url.replace("//fixture:", "//other:"),
    `${url}?sslmode=require`,
  ]) {
    assert.throws(() => validateTestConfiguration({
      ...configured(), TEST_DATABASE_URL: changed,
    }), /DATABASE_TARGET_NOT_APPROVED/);
  }
  assert.equal(validateTestConfiguration(configured()).databaseName, "fixture_store");
});

test("all supplied target URLs are forbidden, including loopback and empty values", () => {
  for (const key of ["BASE_URL", "SUPPORTER_DEV_BASE_URL"]) {
    for (const value of ["https://production.invalid", "http://localhost:5000", "http://127.0.0.1:5000", ""]) {
      assert.throws(() => validateTestConfiguration({ ...configured(), [key]: value }), /EXISTING_APP_URL_FORBIDDEN/);
    }
  }
});

test("malformed URLs and driver target overrides stop with safe errors", () => {
  for (const value of [
    "not-a-url",
    "https://fixture:synthetic-password@isolated.invalid/db",
    `${url}?host=different.invalid`,
    `${url}?options=arbitrary`,
    `${url}?sslmode=require&sslmode=disable`,
    `${url}#fragment`,
    url.replace("fixture_store", "%00"),
  ]) {
    assert.throws(() => validateTestConfiguration({ ...configured(), TEST_DATABASE_URL: value }), (err) => {
      assert.ok(!err.message.includes(value));
      assert.ok(!err.message.includes("synthetic-password"));
      assert.ok(!err.message.includes("isolated.invalid"));
      return /Test safety stop:/.test(err.message);
    });
  }
});

test("approval failure never prints credentials, host, or connection string", () => {
  assert.throws(() => validateTestConfiguration({
    TEST_DATABASE_URL: url, TEST_DATABASE_APPROVED_SHA256: "0".repeat(64),
  }), (err) => {
    for (const value of [url, "synthetic-password", "isolated.invalid"]) {
      assert.ok(!err.message.includes(value));
    }
    return true;
  });
});

test("server environment contains approved test settings only", () => {
  const config = validateTestConfiguration(configured());
  const child = buildChildEnvironment({
    PATH: "/synthetic/bin",
    DATABASE_URL: "do-not-inherit",
    PGPASSWORD: "do-not-inherit",
    NODE_OPTIONS: "--require unsafe",
    SESSION_SECRET: "do-not-inherit",
    ADMIN_KEY: "do-not-inherit",
    LINE_CHANNEL_SECRET: "do-not-inherit",
    REPLIT_DEV_DOMAIN: "do-not-inherit",
    BASE_URL: "do-not-inherit",
    HTTP_PROXY: "do-not-inherit",
    HOME: "/do-not-inherit",
    XDG_CACHE_HOME: "/do-not-inherit",
  }, config);
  assert.equal(child.DATABASE_URL, url);
  assert.equal(child.PATH, "/synthetic/bin");
  for (const key of ["PGPASSWORD", "NODE_OPTIONS", "SESSION_SECRET", "ADMIN_KEY", "LINE_CHANNEL_SECRET", "REPLIT_DEV_DOMAIN", "BASE_URL", "HTTP_PROXY", "HOME", "XDG_CACHE_HOME"]) {
    assert.equal(child[key], undefined);
  }
});

test("nested servers cannot override approved DB, credentials, or ownership", () => {
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "TEST_RUN_CONTEXT_FILE", "SESSION_SECRET", "HOME", "PGPASSFILE", "PATH", "NODE_OPTIONS", "NODE_ENV"]) {
    assert.throws(() => validateChildOverrides({ [key]: "must-not-leak" }), (err) => {
      assert.ok(!err.message.includes("must-not-leak"));
      return /CHILD_OVERRIDE_FORBIDDEN/.test(err.message);
    });
  }
  assert.deepEqual(validateChildOverrides({ FAMILY_ENUM_LIMIT: "5" }), { FAMILY_ENUM_LIMIT: "5" });
  assert.throws(() => validateChildOverrides({ FAMILY_ENUM_LIMIT: "0" }), /CHILD_OVERRIDE_FORBIDDEN/);
});

test("ephemeral entrypoint rejects every caller database or app endpoint override", () => {
  for (const key of [
    "DATABASE_URL",
    "TEST_DATABASE_URL",
    "TEST_DATABASE_APPROVED_SHA256",
    "BASE_URL",
    "SUPPORTER_DEV_BASE_URL",
    "PGPASSWORD",
    "PGHOST",
    "POSTGRES_URL",
    "TEST_RUN_CONTEXT_FILE",
  ]) {
    assert.throws(
      () => assertEphemeralCallerEnvironment({ PATH: "/synthetic/bin", [key]: "synthetic-value" }),
      /CALLER_DATABASE_OR_NETWORK_OVERRIDE_FORBIDDEN/,
    );
  }
  assert.doesNotThrow(() => assertEphemeralCallerEnvironment({ PATH: "/synthetic/bin", LANG: "C" }));
});

test("ephemeral cleanup policy permits only its exact private /tmp layout", () => {
  const root = "/tmp/ephemeral-postgres-fixture_123";
  assert.equal(isOwnedEphemeralDirectory(root), true);
  for (const unsafe of [
    "/tmp",
    "/tmp/ephemeral-postgres-",
    "/tmp/ephemeral-postgres-fixture/child",
    "/tmp/managed-test-fixture",
    "/home/runner/ephemeral-postgres-fixture",
  ]) {
    assert.equal(isOwnedEphemeralDirectory(unsafe), false);
  }
  assert.doesNotThrow(() => assertOwnedEphemeralLayout({
    root,
    dataDirectory: `${root}/data`,
    socketDirectory: `${root}/socket`,
    pgpassFile: `${root}/pgpass`,
  }));
  assert.throws(() => assertOwnedEphemeralLayout({
    root,
    dataDirectory: "/tmp/not-owned-data",
    socketDirectory: `${root}/socket`,
    pgpassFile: `${root}/pgpass`,
  }), /INVALID_EPHEMERAL_OWNERSHIP_LAYOUT/);
});

test("ephemeral children receive a complete generated environment, never caller settings", () => {
  const child = buildEphemeralChildEnvironment({
    ephemeral: true,
    root: "/tmp/ephemeral-postgres-fixture_123",
    pgpassFile: "/tmp/ephemeral-postgres-fixture_123/pgpass",
    databaseUrl: "postgresql://fixture@127.0.0.1:54321/postgres?sslmode=disable",
    fingerprint: "a".repeat(64),
    safePath: "/synthetic/bin",
  });
  assert.equal(child.PGPASSFILE, "/tmp/ephemeral-postgres-fixture_123/pgpass");
  assert.equal(child.DATABASE_URL.includes("synthetic-password"), false);
  for (const key of ["PGPASSWORD", "PGHOST", "BASE_URL", "HTTP_PROXY", "NODE_OPTIONS", "ADMIN_KEY"]) {
    assert.equal(child[key], undefined);
  }
});

test("cleanup decision retains every unresolved ownership boundary", () => {
  assert.equal(cleanupDecision(), "remove");
  assert.equal(cleanupDecision({ unverifiedSpawned: true }), "retain");
  assert.equal(cleanupDecision({ managedResidual: true }), "retain");
  assert.equal(cleanupDecision({ activeOperation: true }), "retain");
  assert.throws(() => cleanupDecision({ managedResidual: "no" }), /INVALID_CLEANUP_DECISION/);
});

test("interruption plan stops owned work but never races cleanup", () => {
  assert.deepEqual(interruptionPlan({ hasOwnedCommand: true, hasSchemaClient: true }), {
    stopOwnedCommand: true,
    closeSchemaClient: true,
    cleanupImmediately: false,
  });
  assert.deepEqual(interruptionPlan(), {
    stopOwnedCommand: false,
    closeSchemaClient: false,
    cleanupImmediately: false,
  });
  assert.throws(() => interruptionPlan({ hasOwnedCommand: "yes" }), /INVALID_INTERRUPTION_PLAN/);
});