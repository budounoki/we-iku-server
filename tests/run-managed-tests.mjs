/*
 * The only launcher for tests which use the database, an application server,
 * or a browser pointed at the application.  It creates a private, short-lived
 * authorization context and gives children a sanitized environment.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { spawnManagedServer } from "./safety/managed-server.mjs";
import { once } from "node:events";
import {
  assertOwnedEphemeralLayout,
  buildEphemeralChildEnvironment,
  isOwnedEphemeralDirectory,
  managedFeatureEnvironment,
} from "./safety/policy.mjs";
import { stopOwnedProcess, trackOwnedProcess } from "./safety/owned-process.mjs";

const GROUPS = new Set([
  "lifecycle",
  "authz",
  "supporter",
  "provisioning",
  "development",
  "browser",
  "consultation",
  "consultation-browser",
  "evidence",
  "evidence-real",
  "evidence-prototype",
  "evidence-prototype-lifecycle",
  "normal-route-verification",
  "normal-route-lifecycle",
]);
const AUTHZ_FILES = [
  // log-authz / resource-authz / create-authz / sleep-linkage assert the
  // origin app's per-row family-ownership layer (mutations must carry
  // familyId) and its sleep start-log design. This app's shipped web/mobile
  // clients do not send familyId on mutation routes yet, and settling data
  // lives on sleep_sessions instead of a start log, so those suites do not
  // describe this codebase. Porting the ownership layer is a separate,
  // client-coordinated change (see supporter integration notes).
  "tests/family-id-rotation.test.mjs",
  "tests/sleep-trend-records.test.mts",
];
const GROUP_FILES = {
  lifecycle: [],
  supporter: ["tests/supporter-integration.test.mts"],
  provisioning: ["tests/supporter-provisioning.test.mts"],
  development: ["tests/supporter-development.test.mts"],
  browser: ["tests/supporter-browser.test.mts", "tests/supporter-development-browser.test.mts"],
  consultation: ["tests/consultations-integration.test.mts"],
  "consultation-browser": ["tests/consultations-browser.test.mts"],
  evidence: [
    "tests/safety/evidence-http.unit.test.mts",
    "tests/evidence-retrieval-integration.test.mts",
  ],
  "evidence-real": [
    "tests/evidence-real-corpus.test.mts",
  ],
  "evidence-prototype": [
    "tests/evidence-consultation-browser.test.mts",
    "tests/evidence-answer-browser.test.mts",
  ],
  "evidence-prototype-lifecycle": [],
  "normal-route-verification": [
    "tests/evidence-normal-route-verification.test.mts",
  ],
  "normal-route-lifecycle": [],
};
const APP_GROUPS = new Set(["lifecycle", "authz", "browser", "consultation", "consultation-browser", "evidence", "evidence-real", "evidence-prototype", "evidence-prototype-lifecycle", "normal-route-verification"]);
const FORBIDDEN_CALLER_KEYS = [
  "BASE_URL",
  "SUPPORTER_DEV_BASE_URL",
  "TEST_RUN_CONTEXT_FILE",
  "TEST_RUN_CONTEXT",
  "MANAGED_TEST_CONTEXT_FILE",
];

export function assertNoCallerOverrides(env = process.env) {
  if (FORBIDDEN_CALLER_KEYS.some((key) => Object.hasOwn(env, key))) {
    throw new Error("managed test launcher refuses caller-supplied network overrides");
  }
}

function launcherStartTime() {
  if (process.platform !== "linux") {
    throw new Error("managed test launcher requires Linux process ancestry");
  }
  const stat = fs.readFileSync(`/proc/${process.pid}/stat`, "utf8");
  const closingParen = stat.lastIndexOf(")");
  const fields = stat.slice(closingParen + 2).trim().split(/\s+/);
  const startTime = fields[19];
  if (!startTime) throw new Error("managed test launcher could not identify its process");
  return startTime;
}

function writeContext(directory, context) {
  const file = path.join(directory, "context.json");
  const descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(context));
  } finally {
    fs.closeSync(descriptor);
  }
  fs.chmodSync(file, 0o600);
  return file;
}

function updateContext(file, context) {
  const temporary = `${file}.next`;
  const descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(context));
  } finally {
    fs.closeSync(descriptor);
  }
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
}

async function waitForReady(child, baseURL, diagnosticCode = () => "app-exited", timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`managed application readiness: ${diagnosticCode()}`);
    try {
      const response = await fetch(`${baseURL}/api/logs/readiness-probe-family`);
      if (response.status < 500) return;
    } catch {
      // The application is still starting.  Do not expose response/error data.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("managed application readiness: timeout");
}

function fixedFailureStage(error) {
  const message = String(error?.message || "");
  const match = message.match(/^managed application (?:startup|readiness): (authorization-guard|module-resolution|tsx-bootstrap|database-environment|app-exited|spawn-error|timeout|invalid-listener)$/);
  if (match) return match[1];
  if (/cleanup|ownership was not established/i.test(message)) return "cleanup";
  if (/interrupted/i.test(message)) return "interrupted";
  return "suite-failed";
}

const CONSULTATION_INTEGRATION_MARKER = /^SAFE_TEST_FAILURE_LINE:(\d{1,4})$/;
const REAL_CORPUS_FAILURE_MARKER = /^SAFE_REAL_CORPUS_FAILURE_LINE:(suite|publication|corpus):(\d{1,4})$/;
const MAX_SAFE_CHILD_DIAGNOSTIC_BYTES = 64 * 1024;

function collectSafeChildOutput(stream) {
  let output = "";
  stream?.on("data", (chunk) => {
    // Never relay test output. Retain only a bounded local buffer so the
    // launcher can recognize its own fixed diagnostics after the child exits.
    if (output.length < MAX_SAFE_CHILD_DIAGNOSTIC_BYTES) {
      output += String(chunk).slice(0, MAX_SAFE_CHILD_DIAGNOSTIC_BYTES - output.length);
    }
  });
  return () => output;
}

function consultationIntegrationLine(output) {
  for (const line of output.split(/\r?\n/)) {
    const match = CONSULTATION_INTEGRATION_MARKER.exec(line);
    if (match) return Number(match[1]);
  }
  return null;
}

function realCorpusLine(output) {
  for (const line of output.split(/\r?\n/)) {
    const match = REAL_CORPUS_FAILURE_MARKER.exec(line);
    if (match) return { kind: match[1], line: Number(match[2]) };
  }
  return null;
}

function consultationBrowserLine(output) {
  // Playwright's stack is untrusted test output. Extract only a bounded line
  // number for this exact owned source file; paths, assertion text, page
  // content, cookies, and credentials are deliberately discarded.
  const match = output.match(/(?:^|[\s(])(?:file:\/\/)?[^\s()]*tests\/consultations-browser\.test\.mts:(\d{1,4}):\d+(?:\)|$)/m);
  return match ? Number(match[1]) : null;
}

function consultationBrowserOutcome(output) {
  // The line reporter may include ANSI styling. Read only its final numeric
  // summary and only when it accounts for this file's four declared tests.
  const summary = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "");
  let passed = null;
  let failed = null;
  for (const match of summary.matchAll(/^\s*(\d{1,2})\s+(passed|failed)\b/gmu)) {
    const count = Number(match[1]);
    if (match[2] === "passed") passed = count;
    if (match[2] === "failed") failed = count;
  }
  if (
    passed === null
    || failed === null
    || passed < 0
    || failed < 1
    || passed + failed !== 4
  ) return null;
  return { passed, failed };
}

function evidencePrototypeBrowserLine(output) {
  const match = output.match(/(?:^|[\s(])(?:file:\/\/)?[^\s()]*tests\/(?:evidence-consultation-browser|evidence-answer-browser)\.test\.mts:(\d{1,4}):\d+(?:\)|$)/m);
  return match ? Number(match[1]) : null;
}

function emitSafeChildDiagnostic(kind, output) {
  if (kind === "evidence" || kind === "evidence-real") {
    // Same closed numeric marker as the consultation suite. Never forward
    // assertion text, response bodies, database errors, or credentials.
    const line = consultationIntegrationLine(output);
    if (kind === "evidence" && line !== null) {
      console.error(`managed evidence diagnostic: tests/evidence-retrieval-integration.test.mts:${line}`);
    }
    const realCorpusFailure = realCorpusLine(output);
    if (realCorpusFailure !== null) {
      const paths = {
        suite: "tests/evidence-real-corpus.test.mts",
        publication: "tests/fixtures/real-corpus/publication-simulation.mts",
        corpus: "tests/fixtures/real-corpus/corpus.mts",
      };
      console.error(`managed evidence-real diagnostic: ${paths[realCorpusFailure.kind]}:${realCorpusFailure.line}`);
    }
    return;
  }
  if (kind === "consultation") {
    const line = consultationIntegrationLine(output);
    if (line !== null) console.error(`managed consultation diagnostic: tests/consultations-integration.test.mts:${line}`);
    return;
  }
  if (kind === "consultation-browser") {
    const line = consultationBrowserLine(output);
    if (line !== null) console.error(`managed consultation browser diagnostic: tests/consultations-browser.test.mts:${line}`);
    const outcome = consultationBrowserOutcome(output);
    if (outcome) {
      console.error(`managed consultation browser outcome: passed=${outcome.passed} failed=${outcome.failed}`);
    }
  }
  if (kind === "evidence-prototype") {
    const line = evidencePrototypeBrowserLine(output);
    if (line !== null) console.error(`managed evidence-prototype diagnostic: tests/evidence-prototype browser test:${line}`);
  }
}

async function runChild(file, env, browser = false, onStart, diagnosticKind = null, browserConfig = null) {
  const args = browser
    ? [
      "node_modules/@playwright/test/cli.js",
      "test",
      file,
      ...(browserConfig ? ["--config", browserConfig] : []),
      "--reporter=line",
      "--output",
      path.join(env.HOME, "playwright-results"),
    ]
    : file.endsWith(".mts")
      ? ["--import", "tsx", file]
      : [file];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    detached: true,
    // Test output is untrusted: an assertion/error can serialize a cookie,
    // pgpass path, session secret, or response JSON. The parent reports only
    // its fixed suite status below.
    stdio: diagnosticKind ? ["ignore", "pipe", "pipe"] : "ignore",
  });
  const stdout = collectSafeChildOutput(child.stdout);
  const stderr = collectSafeChildOutput(child.stderr);
  onStart?.(Object.freeze({ unverified: true, pid: child.pid || null }));
  let record;
  try {
    record = trackOwnedProcess(child);
    onStart?.(record);
  } catch {
    throw new Error("managed test child ownership was not established");
  }
  const [code, signal] = await once(child, "close");
  await stopOwnedProcess(record);
  if (code !== 0) {
    if (diagnosticKind) emitSafeChildDiagnostic(diagnosticKind, `${stdout()}\n${stderr()}`);
    throw new Error(`managed test failed: ${signal ? "signal" : "nonzero exit"}`);
  }
}

async function stopTrackedProcess(record, config) {
  if (!record) return;
  if (record.unverified) {
    config.cleanupState.managedResidual = true;
    throw new Error("managed child cleanup was not confirmed");
  }
  try {
    await stopOwnedProcess(record);
  } catch {
    config.cleanupState.managedResidual = true;
    throw new Error("managed child cleanup was not confirmed");
  }
}

function groupEnvironment(base, group, config) {
  const env = {
    ...base,
    NODE_ENV: "development",
    SESSION_SECRET: base.SESSION_SECRET || randomBytes(32).toString("hex"),
  };
  // Keep the allowlist closed even if this helper is later called with a
  // richer base object. Historical groups must neither inherit nor explicitly
  // receive the consultation switch.
  delete env.CONSULTATIONS_ENABLED;
  delete env.EVIDENCE_SEARCH_ENABLED;
  delete env.EVIDENCE_PROTOTYPE_TEST;
  delete env.EVIDENCE_PROTOTYPE_LIFECYCLE;
  delete env.EVIDENCE_PROTOTYPE_DRAFT;

  if (group === "authz") {
    env.SUPPORTER_ACCESS_ENABLED = "false";
    env.SUPPORTER_DEV_FIXTURES_ENABLED = "false";
    env.FAMILY_ENUM_LIMIT = "1000";
  }
  if (group === "browser") {
    env.SUPPORTER_ACCESS_ENABLED = "true";
    env.SUPPORTER_DEV_FIXTURES_ENABLED = "true";
    env.SUPPORTER_DEV_DATABASE_NAME = config.databaseName;
    // Chromium executable location, not a credential. The isolated HOME
    // hides the default playwright cache, so the path must be passed in.
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
  }
  if (group === "supporter") {
    env.NODE_ENV = "test";
    env.SUPPORTER_ACCESS_ENABLED = "true";
    env.ADMIN_KEY = "supporter-integration-admin-key";
  }
  if (group === "provisioning") {
    env.NODE_ENV = "test";
    env.SUPPORTER_ACCESS_ENABLED = "true";
    env.ADMIN_KEY = "supporter-provisioning-test-key";
  }
  if (group === "development") {
    env.SUPPORTER_ACCESS_ENABLED = "true";
    env.SUPPORTER_DEV_FIXTURES_ENABLED = "true";
    env.SUPPORTER_DEV_DATABASE_NAME = config.databaseName;
  }
  // Opt-ins are deliberately assigned only to their dedicated suites.
  // `base` is a complete generated environment, not process.env, so a
  // caller cannot enable the feature for historical lifecycle suites by
  // supplying an environment variable.
  if (group === "consultation" || group === "consultation-browser" || group === "evidence" || group === "evidence-real" || group === "evidence-prototype" || group === "evidence-prototype-lifecycle") {
    // evidence-real intentionally receives the exact evidence feature
    // allowlist, but is scheduled as its own fresh-cluster group.
    Object.assign(env, managedFeatureEnvironment(group === "evidence-real" ? "evidence" : group));
  }
  if (group === "evidence-prototype" || group === "evidence-prototype-lifecycle") {
    // The prototype server is a separate, test-only process. It rejects the
    // ordinary development environment before it imports its pool.
    env.NODE_ENV = "test";
  }
  if (group === "normal-route-verification" || group === "normal-route-lifecycle") {
    env.NODE_ENV = "test";
    if (group === "normal-route-verification") Object.assign(env, managedFeatureEnvironment(group));
  }
  return env;
}

async function runGroup(group, config) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "managed-test-"));
  fs.chmodSync(directory, 0o700);
  let server;
  let hasEvidencePrivacyLeak = () => false;
  let serverRecord;
  let activeTest;
  let baseURL = null;
  let contextFile;
  let interrupted = Boolean(config.cleanupState.interrupted);
  const stopForSignal = () => {
    interrupted = true;
    config.cleanupState.interrupted = true;
    void stopTrackedProcess(activeTest, config).catch(() => {});
    void stopTrackedProcess(serverRecord, config).catch(() => {});
  };
  process.once("SIGINT", stopForSignal);
  process.once("SIGTERM", stopForSignal);
  process.once("SIGHUP", stopForSignal);
  try {
    if (interrupted) throw new Error("managed test launcher interrupted");
    const ownerStartTime = launcherStartTime();
    const pgpassfile = path.join(directory, ".pgpass");
    const pgservicefile = path.join(directory, ".pg_service.conf");
    fs.rmSync(pgpassfile, { force: true });
    fs.rmSync(pgservicefile, { force: true });
    const baseEnvironment = {
      ...buildEphemeralChildEnvironment(config),
      // The run directory is private (0700) and is also the only HOME
      // available to nested test/application children.
      HOME: directory,
      PGPASSFILE: config.pgpassFile,
      PGSERVICEFILE: pgservicefile,
      NODE_ENV: "development",
      SESSION_SECRET: randomBytes(32).toString("hex"),
    };
    // Older policy implementations may still include these cache paths.
    // Never let a test child reuse a caller cache after the policy is updated.
    delete baseEnvironment.XDG_CACHE_HOME;

    if (APP_GROUPS.has(group)) {
      contextFile = writeContext(directory, {
        approvedFingerprint: config.fingerprint,
        baseURL: null,
        ownerPid: process.pid,
        ownerStartTime,
        pgpassPath: config.pgpassFile,
      });
      const started = await spawnManagedServer(
        groupEnvironment({ ...baseEnvironment, TEST_RUN_CONTEXT_FILE: contextFile }, group, config),
        {
          onRecord: (record) => { serverRecord = record; },
          onResidual: () => { config.cleanupState.managedResidual = true; },
        },
        group === "evidence-prototype"
          ? "evidence-prototype"
          : group === "evidence-prototype-lifecycle"
            ? "evidence-prototype-lifecycle"
            : group === "normal-route-verification" ? "evidence-prototype-draft" : "application",
      );
      server = started.child;
      hasEvidencePrivacyLeak = started.hasEvidencePrivacyLeak;
      baseURL = started.baseURL;
      updateContext(contextFile, {
        approvedFingerprint: config.fingerprint,
        baseURL,
        ownerPid: process.pid,
        ownerStartTime,
        pgpassPath: config.pgpassFile,
      });
      // The prototype exposes only `/`, assets, and one POST endpoint: it
      // intentionally has no normal application's readiness route.
      if (group !== "evidence-prototype" && group !== "evidence-prototype-lifecycle") {
        await waitForReady(server, baseURL, started.getDiagnosticCode);
      }
    } else {
      contextFile = writeContext(directory, {
        approvedFingerprint: config.fingerprint,
        baseURL: null,
        ownerPid: process.pid,
        ownerStartTime,
        pgpassPath: config.pgpassFile,
      });
    }

    const childEnvironment = groupEnvironment(
      { ...baseEnvironment, TEST_RUN_CONTEXT_FILE: contextFile },
      group,
      config,
    );
    const files = group === "authz" ? AUTHZ_FILES : GROUP_FILES[group];
    const failures = [];
    for (const file of files) {
      if (interrupted || config.cleanupState.managedResidual) break;
      activeTest = null;
      try {
        await runChild(
          file,
          childEnvironment,
          group === "browser" || group === "consultation-browser" || group === "evidence-prototype",
          (record) => { activeTest = record; },
          group === "consultation" ? "consultation"
            : group === "consultation-browser" ? "consultation-browser"
            : group === "evidence" ? "evidence"
              : group === "evidence-real" ? "evidence-real"
                : group === "evidence-prototype" ? "evidence-prototype" : null,
          group === "evidence-prototype" ? "tests/evidence-prototype.playwright.config.mts" : null,
        );
        console.info(`managed suite outcome: passed (${path.basename(file)})`);
      } catch (error) {
        failures.push(error);
        console.error(`managed suite outcome: failed (${path.basename(file)})`);
      }
      // A failed spawn can leave only an unverified marker. Do not discard it:
      // stopTrackedProcess marks the shared residual boundary and prevents any
      // subsequent suite from being scheduled until cleanup is confirmed.
      const stopped = await Promise.allSettled([stopTrackedProcess(activeTest, config)]);
      if (stopped[0].status === "rejected" || config.cleanupState.managedResidual) {
        break;
      }
      activeTest = null;
    }
    if (interrupted || config.cleanupState.managedResidual) {
      throw new Error("managed test scheduling stopped before cleanup confirmation");
    }
    if (failures.length) {
      throw new Error(`managed group had ${failures.length} failed suite${failures.length === 1 ? "" : "s"}`);
    }
    if (group === "evidence" || group === "evidence-real" || group === "evidence-prototype" || group === "evidence-prototype-lifecycle") {
      if (hasEvidencePrivacyLeak()) throw new Error("evidence privacy log check failed");
      console.info(`managed ${group} privacy log check: passed`);
    }
    console.info(`managed group outcome: passed (${group})`);
  } finally {
    process.off("SIGINT", stopForSignal);
    process.off("SIGTERM", stopForSignal);
    process.off("SIGHUP", stopForSignal);
    const stops = await Promise.allSettled([
      stopTrackedProcess(activeTest, config),
      stopTrackedProcess(serverRecord, config),
    ]);
    if (stops.some((result) => result.status === "rejected")) {
      config.cleanupState.managedResidual = true;
    }
    if (config.cleanupState.managedResidual) {
      console.error(`managed cleanup residual retained: ${directory}`);
    } else {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}

function validateEphemeralManagedConfiguration(config) {
  if (
    !config
    || config.ephemeral !== true
    || typeof config.databaseUrl !== "string"
    || typeof config.databaseName !== "string"
    || typeof config.fingerprint !== "string"
    || typeof config.pgpassFile !== "string"
    || typeof config.root !== "string"
    || typeof config.safePath !== "string"
    || !config.cleanupState
    || typeof config.cleanupState !== "object"
    || typeof config.cleanupState.interrupted !== "boolean"
    || typeof config.cleanupState.managedResidual !== "boolean"
    || !isOwnedEphemeralDirectory(config.root)
  ) {
    throw new Error("managed tests require the ephemeral PostgreSQL launcher");
  }
  assertOwnedEphemeralLayout({
    root: config.root,
    dataDirectory: path.join(config.root, "data"),
    socketDirectory: path.join(config.root, "socket"),
    pgpassFile: config.pgpassFile,
  });
}

export function normalizeManagedGroups(requestedGroups = []) {
  if (!Array.isArray(requestedGroups)) throw new Error("unknown managed test group");
  const names = requestedGroups.length === 0 || requestedGroups.includes("all")
    // evidence-real is deliberately opt-in: `all` would otherwise run it in
    // the same cluster as fictional evidence fixtures.
    ? [...GROUPS].filter((group) => group !== "evidence-real" && group !== "evidence-prototype" && group !== "evidence-prototype-lifecycle")
    : requestedGroups;
  if (names.some((name) => !GROUPS.has(name))) {
    throw new Error("unknown managed test group");
  }
  return names;
}

export async function runManagedTests(requestedGroups = process.argv.slice(2), config) {
  assertNoCallerOverrides();
  validateEphemeralManagedConfiguration(config);
  const names = normalizeManagedGroups(requestedGroups);
  // The real licensed corpus is intentionally never colocated with the
  // fictional/general retrieval suite. Its caller must give it a dedicated
  // ephemeral-launcher invocation, which in turn creates a fresh cluster.
  if ((names.includes("evidence-real") || names.includes("evidence-prototype") || names.includes("evidence-prototype-lifecycle")
    || names.includes("normal-route-verification") || names.includes("normal-route-lifecycle")) && names.length !== 1) {
    throw new Error("dedicated evidence groups must run in their own ephemeral invocation");
  }
  const failures = [];
  for (const group of names) {
    if (config.cleanupState.interrupted || config.cleanupState.managedResidual) {
      failures.push(config.cleanupState.interrupted ? "interrupted" : "cleanup");
      break;
    }
    try {
      await runGroup(group, config);
    } catch (error) {
      failures.push(group);
      console.error(`managed group outcome: failed (${group}) [${fixedFailureStage(error)}]`);
    }
  }
  if (failures.length) throw new Error(`managed groups failed: ${failures.join(",")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    await runManagedTests();
  } catch {
    // Never forward child/app/DB errors.  The exit status is the only detail a
    // caller needs; the generic message is intentionally DSN-free.
    console.error("managed tests failed; invoke tests/run-ephemeral-tests.mjs");
    process.exitCode = 1;
  }
}
