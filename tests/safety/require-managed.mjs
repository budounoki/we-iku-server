/*
 * Import this module before importing anything which can reach the database or
 * the network.  A test is authorized only when it is a descendant of the
 * managed launcher which created its private context file.
 *
 * The context deliberately contains no DSN.  The launcher supplies the
 * dedicated DSN to the child environment and this module binds that value to
 * the fingerprint in the context before a test may continue.
 */
import fs from "node:fs";
import path from "node:path";
import {
  databaseTargetFingerprint,
  validateChildOverrides,
  validateTestConfiguration,
} from "./policy.mjs";

const CONTEXT_ENV_KEY = "TEST_RUN_CONTEXT_FILE";
const EXPECTED_CONTEXT_KEYS = new Set([
  "approvedFingerprint",
  "baseURL",
  "ownerPid",
  "ownerStartTime",
  "pgpassPath",
]);

function fail() {
  throw new Error("managed test authorization required");
}

function readProcStat(pid) {
  if (process.platform !== "linux" || !Number.isInteger(pid) || pid <= 1) {
    fail();
  }
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const closingParen = stat.lastIndexOf(")");
    if (closingParen < 0) fail();
    const fields = stat.slice(closingParen + 2).trim().split(/\s+/);
    // The slice starts at field 3 (state), so field 22 (starttime) is index 19.
    const startTime = fields[19];
    const parentPid = Number(fields[1]);
    if (!startTime || !Number.isInteger(parentPid) || parentPid < 0) fail();
    return { parentPid, startTime };
  } catch {
    fail();
  }
}

function assertLauncherCommand(pid) {
  try {
    const allowedScripts = new Set([
      "../run-ephemeral-tests.mjs",
      "../run-managed-tests.mjs",
      "../run-authz-tests.mjs",
    ].map((relative) => path.resolve(new URL(relative, import.meta.url).pathname)));
    const argv = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
    // Match a complete argv path rather than an arbitrary cmdline substring.
    // This accepts `node --import tsx tests/run-ephemeral-tests.mjs …` but
    // not an unrelated program which merely mentions that filename.
    if (!argv.some((argument) => allowedScripts.has(path.resolve(argument)))) fail();
  } catch {
    fail();
  }
}

function assertPrivateContextFile(file) {
  if (process.platform !== "linux" || !path.isAbsolute(file)) fail();
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    fail();
  }
  if (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail();
  if (!stat.isFile()) fail();
}

function readContext() {
  const file = process.env[CONTEXT_ENV_KEY];
  if (!file || Object.hasOwn(process.env, "BASE_URL") || Object.hasOwn(process.env, "SUPPORTER_DEV_BASE_URL")) {
    fail();
  }
  assertPrivateContextFile(file);

  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const keys = Object.keys(value);
  if (keys.some((key) => !EXPECTED_CONTEXT_KEYS.has(key))) fail();
  if (!keys.every((key) => EXPECTED_CONTEXT_KEYS.has(key))) fail();
  if (typeof value.approvedFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.approvedFingerprint)) fail();
  if (!Number.isInteger(value.ownerPid) || value.ownerPid <= 1 || typeof value.ownerStartTime !== "string" || !value.ownerStartTime) fail();
  if (typeof value.pgpassPath !== "string" || !path.isAbsolute(value.pgpassPath)) fail();
  if (value.baseURL !== null && typeof value.baseURL !== "string") fail();
  if (typeof value.baseURL === "string") {
    let url;
    try {
      url = new URL(value.baseURL);
    } catch {
      fail();
    }
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname) || !url.port) fail();
  }
  return Object.freeze({
    approvedFingerprint: value.approvedFingerprint,
    baseURL: value.baseURL,
    ownerPid: value.ownerPid,
    ownerStartTime: value.ownerStartTime,
    pgpassPath: value.pgpassPath,
  });
}

function assertLauncherIdentity(context) {
  // A process cannot authorize itself by writing a context whose ownerPid is
  // its own PID.  The owner must also be one of the repository launchers,
  // rather than an arbitrary shell which happened to spawn this process.
  if (context.ownerPid === process.pid) fail();
  const owner = readProcStat(context.ownerPid);
  if (owner.startTime !== context.ownerStartTime) fail();
  assertLauncherCommand(context.ownerPid);

  // Check the real process ancestry, not an environment marker.  This also
  // rejects a reused PID whose start identity no longer matches the context.
  const seen = new Set();
  let pid = process.pid;
  for (let depth = 0; depth < 128; depth += 1) {
    if (pid === context.ownerPid) return;
    if (seen.has(pid)) fail();
    seen.add(pid);
    const current = readProcStat(pid);
    if (current.parentPid <= 1) fail();
    pid = current.parentPid;
  }
  fail();
}

function assertDedicatedDatabase(context) {
  const databaseUrl = process.env.DATABASE_URL;
  const configuredUrl = process.env.TEST_DATABASE_URL;
  const configuredFingerprint = process.env.TEST_DATABASE_APPROVED_SHA256;
  if (!databaseUrl || configuredUrl !== databaseUrl || configuredFingerprint !== context.approvedFingerprint) fail();
  let fingerprint;
  try {
    fingerprint = databaseTargetFingerprint(databaseUrl);
    // Validate the same canonical endpoint/fingerprint pair used by the
    // launcher.  Both dedicated values are supplied by buildChildEnvironment;
    // ordinary DATABASE_URL is never used as a fallback.
    validateTestConfiguration({
      TEST_DATABASE_URL: configuredUrl,
      TEST_DATABASE_APPROVED_SHA256: configuredFingerprint,
    });
  } catch {
    fail();
  }
  if (fingerprint !== context.approvedFingerprint) fail();
}

function assertPrivateCredentialFile(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    fail();
  }
  if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail();
}

const managedContext = readContext();
assertLauncherIdentity(managedContext);
assertDedicatedDatabase(managedContext);

// Managed children are deliberately placed in private process groups so the
// launcher can reap descendants. If the launcher itself is killed abruptly,
// do not leave an application process (and its database pool) behind. The
// unref'ed watchdog never keeps a successful test alive.
const launcherWatchdog = setInterval(() => {
  try {
    if (readProcStat(managedContext.ownerPid).startTime !== managedContext.ownerStartTime) {
      process.exitCode = 1;
      process.exit();
    }
  } catch {
    process.exitCode = 1;
    process.exit();
  }
}, 500);
launcherWatchdog.unref();

export function getManagedTestContext() {
  return managedContext;
}

/*
 * For a test which must create an additional in-process Express server, use
 * this allowlisted environment rather than spreading the caller environment.
 * It contains the verified child DSN but never the context-file contents.
 */
export function getManagedTestEnvironment(overrides = {}) {
  let safeOverrides;
  try {
    safeOverrides = validateChildOverrides(overrides);
  } catch {
    fail();
  }

  const contextFile = process.env[CONTEXT_ENV_KEY];
  if (!contextFile || !path.isAbsolute(contextFile)) fail();
  const home = path.dirname(contextFile);
  let homeStat;
  try {
    homeStat = fs.statSync(home);
  } catch {
    fail();
  }
  if (
    !homeStat.isDirectory()
    || homeStat.uid !== process.getuid?.()
    || (homeStat.mode & 0o077) !== 0
  ) {
    fail();
  }
  const pgpassfile = managedContext.pgpassPath;
  const pgservicefile = path.join(home, ".pg_service.conf");
  if (process.env.PGPASSFILE !== pgpassfile || process.env.PGSERVICEFILE !== pgservicefile) fail();
  assertPrivateCredentialFile(pgpassfile);
  if (fs.existsSync(pgservicefile)) fail();

  const allowed = {
    PATH: process.env.PATH,
    HOME: home,
    PGPASSFILE: pgpassfile,
    PGSERVICEFILE: pgservicefile,
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    TEST_DATABASE_APPROVED_SHA256: process.env.TEST_DATABASE_APPROVED_SHA256,
    SESSION_SECRET: process.env.SESSION_SECRET,
    SUPPORTER_ACCESS_ENABLED: process.env.SUPPORTER_ACCESS_ENABLED,
    SUPPORTER_DEV_FIXTURES_ENABLED: process.env.SUPPORTER_DEV_FIXTURES_ENABLED,
    SUPPORTER_DEV_DATABASE_NAME: process.env.SUPPORTER_DEV_DATABASE_NAME,
    FAMILY_ENUM_LIMIT: process.env.FAMILY_ENUM_LIMIT,
    FAMILY_ENUM_WINDOW_MS: process.env.FAMILY_ENUM_WINDOW_MS,
    EVIDENCE_SEARCH_ENABLED: process.env.EVIDENCE_SEARCH_ENABLED,
    EVIDENCE_PROTOTYPE_TEST: process.env.EVIDENCE_PROTOTYPE_TEST,
    EVIDENCE_PROTOTYPE_LIFECYCLE: process.env.EVIDENCE_PROTOTYPE_LIFECYCLE,
    EVIDENCE_PROTOTYPE_DRAFT: process.env.EVIDENCE_PROTOTYPE_DRAFT,
    TEST_RUN_CONTEXT_FILE: process.env.TEST_RUN_CONTEXT_FILE,
  };
  for (const [key, value] of Object.entries(safeOverrides)) {
    allowed[key] = value;
  }
  return Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
}
