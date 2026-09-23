/**
 * Pure test-target policy: no environment reads, sockets, DB imports or writes.
 * Approval is a human-reviewed fingerprint, never a database-name heuristic.
 */
import { createHash } from "node:crypto";

function reject(code) {
  throw new Error(`Test safety stop: ${code}. No connection is permitted.`);
}

// The ephemeral launcher deliberately does not accept a target from its
// parent.  Keeping this check pure makes the boundary testable without
// starting a database (and prevents a forgotten environment spread later).
const EPHEMERAL_CALLER_FORBIDDEN_COMPACT =
  /^(?:DATABASE_URL|TEST_DATABASE_URL|TEST_DATABASE_APPROVED_SHA256|TEST_RUN_CONTEXT(?:_FILE)?|MANAGED_TEST_CONTEXT_FILE|BASE_URL|SUPPORTER_DEV_BASE_URL|REPLIT_DEV_DOMAIN|PG[A-Z0-9_]*|POSTGRES[A-Z0-9_]*)$/;

export function assertEphemeralCallerEnvironment(env = {}) {
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    reject("INVALID_EPHEMERAL_LAUNCH_ENVIRONMENT");
  }
  if (Object.keys(env).some((key) => EPHEMERAL_CALLER_FORBIDDEN_COMPACT.test(key))) {
    reject("CALLER_DATABASE_OR_NETWORK_OVERRIDE_FORBIDDEN");
  }
}

export function isOwnedEphemeralDirectory(candidate) {
  // This is intentionally a lexical policy only. The harness additionally
  // checks realpath, ownership, and permissions immediately before deletion.
  return typeof candidate === "string"
    && /^\/tmp\/ephemeral-postgres-[A-Za-z0-9_-]+$/.test(candidate);
}

export function assertOwnedEphemeralLayout({ root, dataDirectory, socketDirectory, pgpassFile }) {
  if (
    !isOwnedEphemeralDirectory(root)
    || dataDirectory !== `${root}/data`
    || socketDirectory !== `${root}/socket`
    || pgpassFile !== `${root}/pgpass`
  ) {
    reject("INVALID_EPHEMERAL_OWNERSHIP_LAYOUT");
  }
}

export function cleanupDecision({ unverifiedSpawned = false, managedResidual = false, activeOperation = false } = {}) {
  if ([unverifiedSpawned, managedResidual, activeOperation].some((value) => typeof value !== "boolean")) {
    reject("INVALID_CLEANUP_DECISION");
  }
  return !unverifiedSpawned && !managedResidual && !activeOperation ? "remove" : "retain";
}

export function interruptionPlan({ hasOwnedCommand = false, hasSchemaClient = false } = {}) {
  if (typeof hasOwnedCommand !== "boolean" || typeof hasSchemaClient !== "boolean") {
    reject("INVALID_INTERRUPTION_PLAN");
  }
  // Cleanup must wait for the interrupted operation's own finally path.
  return Object.freeze({
    stopOwnedCommand: hasOwnedCommand,
    closeSchemaClient: hasSchemaClient,
    cleanupImmediately: false,
  });
}

function parseTarget(value) {
  if (typeof value !== "string" || !value.trim()) reject("TEST_DATABASE_URL_REQUIRED");
  let url;
  try {
    url = new URL(value);
  } catch {
    reject("INVALID_TEST_DATABASE_CONFIGURATION");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash) {
    reject("INVALID_TEST_DATABASE_CONFIGURATION");
  }
  // libpq-style overrides/options and alternate hosts must not change the
  // endpoint after approval. TLS is the only supported optional parameter.
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== "sslmode") || new Set(keys).size !== keys.length) {
    reject("UNSUPPORTED_TEST_DATABASE_OPTIONS");
  }
  if (url.searchParams.has("sslmode") &&
      !["disable", "require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"))) {
    reject("UNSUPPORTED_TEST_DATABASE_OPTIONS");
  }
  let databaseName;
  let username;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
    username = decodeURIComponent(url.username);
  } catch {
    reject("INVALID_TEST_DATABASE_CONFIGURATION");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(databaseName) || !username ||
      /[\u0000-\u0020]/.test(username) || url.hostname.includes(",")) {
    reject("INVALID_TEST_DATABASE_CONFIGURATION");
  }
  return { url, databaseName, username };
}

export function databaseTargetFingerprint(databaseUrl) {
  const { url, databaseName, username } = parseTarget(databaseUrl);
  const identity = JSON.stringify({
    protocol: "postgresql",
    host: url.hostname.toLowerCase(),
    port: url.port || "5432",
    database: databaseName,
    username,
    sslmode: url.searchParams.get("sslmode") || "",
  });
  return createHash("sha256").update(identity).digest("hex");
}

export function validateTestConfiguration(env) {
  // Even localhost can be a shared app or forward to production.
  if (env.BASE_URL !== undefined || env.SUPPORTER_DEV_BASE_URL !== undefined) {
    reject("EXISTING_APP_URL_FORBIDDEN");
  }
  const { databaseName } = parseTarget(env.TEST_DATABASE_URL);
  const approved = env.TEST_DATABASE_APPROVED_SHA256;
  if (typeof approved !== "string" || !/^[a-f0-9]{64}$/.test(approved)) {
    reject("EXPLICIT_DATABASE_APPROVAL_REQUIRED");
  }
  const fingerprint = databaseTargetFingerprint(env.TEST_DATABASE_URL);
  if (fingerprint !== approved) reject("DATABASE_TARGET_NOT_APPROVED");
  return Object.freeze({
    databaseUrl: env.TEST_DATABASE_URL,
    databaseName,
    fingerprint,
  });
}

export function buildChildEnvironment(env, config) {
  // Do not inherit ordinary DB credentials, NODE_OPTIONS/preloads, proxies,
  // login credentials, public app domains, or caller-supplied test URLs.
  const child = {};
  for (const key of [
    "PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "TZ",
    "PLAYWRIGHT_BROWSERS_PATH",
  ]) {
    if (typeof env[key] === "string") child[key] = env[key];
  }
  return {
    ...child,
    NODE_ENV: "development",
    DATABASE_URL: config.databaseUrl,
    TEST_DATABASE_URL: config.databaseUrl,
    TEST_DATABASE_APPROVED_SHA256: config.fingerprint,
  };
}

// Feature switches for managed groups are launcher-owned constants. They are
// intentionally not read from `env`: the caller of a test command must never
// be able to turn on a feature for a child by inheriting an environment value.
export function managedFeatureEnvironment(group) {
  if (group === "evidence") {
    return Object.freeze({ EVIDENCE_SEARCH_ENABLED: "true" });
  }
  if (group === "evidence-prototype") {
    return Object.freeze({
      EVIDENCE_SEARCH_ENABLED: "true",
      EVIDENCE_PROTOTYPE_TEST: "true",
    });
  }
  if (group === "evidence-prototype-lifecycle") {
    return Object.freeze({
      EVIDENCE_SEARCH_ENABLED: "true",
      EVIDENCE_PROTOTYPE_TEST: "true",
      EVIDENCE_PROTOTYPE_LIFECYCLE: "true",
    });
  }
  if (group === "normal-route-verification") {
    return Object.freeze({
      EVIDENCE_SEARCH_ENABLED: "true",
      EVIDENCE_PROTOTYPE_TEST: "true",
      EVIDENCE_PROTOTYPE_DRAFT: "true",
    });
  }
  if (group === "consultation" || group === "consultation-browser") {
    return Object.freeze({ CONSULTATIONS_ENABLED: "true" });
  }
  return Object.freeze({});
}

export function buildEphemeralChildEnvironment(config) {
  if (
    !config
    || config.ephemeral !== true
    || typeof config.databaseUrl !== "string"
    || typeof config.fingerprint !== "string"
    || typeof config.pgpassFile !== "string"
    || typeof config.root !== "string"
    || typeof config.safePath !== "string"
  ) {
    reject("INVALID_EPHEMERAL_CHILD_CONFIGURATION");
  }
  // This is a complete environment, not a filtered copy. Credentials are
  // resolved by pg from the private pgpass file, never from a password-bearing
  // URL or inherited PGPASSWORD.
  return {
    PATH: config.safePath,
    HOME: config.root,
    TMPDIR: config.root,
    TEMP: config.root,
    TMP: config.root,
    PGPASSFILE: config.pgpassFile,
    PGSERVICEFILE: pathForMissingService(config.root),
    NODE_ENV: "development",
    DATABASE_URL: config.databaseUrl,
    TEST_DATABASE_URL: config.databaseUrl,
    TEST_DATABASE_APPROVED_SHA256: config.fingerprint,
  };
}

function pathForMissingService(root) {
  return `${root}/pg_service.conf`;
}

export function validateChildOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    reject("CHILD_OVERRIDE_FORBIDDEN");
  }
  const safe = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (key !== "FAMILY_ENUM_LIMIT" || typeof value !== "string" ||
        !/^[1-9]\d{0,4}$/.test(value) || Number(value) > 10000) {
      reject("CHILD_OVERRIDE_FORBIDDEN");
    }
    safe[key] = value;
  }
  return safe;
}