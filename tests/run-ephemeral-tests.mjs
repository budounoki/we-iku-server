/*
 * The sole database-owning test entrypoint. It never accepts a caller DSN:
 * every invocation creates, verifies, uses, and removes one PostgreSQL
 * cluster below a private /tmp directory.
 *
 * Run with: node --import tsx tests/run-ephemeral-tests.mjs [group ...]
 */
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  assertEphemeralCallerEnvironment,
  assertOwnedEphemeralLayout,
  cleanupDecision,
  databaseTargetFingerprint,
  interruptionPlan,
  isOwnedEphemeralDirectory,
} from "./safety/policy.mjs";
import { stopOwnedProcess, trackOwnedProcess } from "./safety/owned-process.mjs";
import { normalizeManagedGroups, runManagedTests } from "./run-managed-tests.mjs";

const START_TIMEOUT_MS = 30_000;
const OUTPUT_LIMIT = 4_096;
const NORMAL_ROUTE_JSON = path.resolve("evidence-work/model-evaluation/normal-route-results.json");
const NORMAL_ROUTE_MARKDOWN = path.resolve("evidence-work/model-evaluation/normal-route-results.md");

function safeFailure(source, secrets = []) {
  let value = String(source?.message || source || "unknown failure")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[redacted-dsn]")
    .replace(/(?:password|pwd)\s*=\s*[^\s'"]+/gi, "$1=[redacted]");
  for (const secret of secrets) {
    if (secret) value = value.replaceAll(secret, "[redacted]");
  }
  return value.replace(/\s+/g, " ").slice(0, OUTPUT_LIMIT);
}

function currentStartTime(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    return stat.slice(close + 2).trim().split(/\s+/)[19] || null;
  } catch {
    return null;
  }
}

function privateFile(file, content) {
  const descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(descriptor, content, { encoding: "utf8" });
  } finally {
    fs.closeSync(descriptor);
  }
  fs.chmodSync(file, 0o600);
}

function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function sanitizedProcessEnvironment(root, binaryDirectory) {
  // Do not spread process.env. In particular, no PG*, HOME, proxy, preload,
  // or application configuration survives into initdb/postgres.
  return {
    PATH: binaryDirectory,
    HOME: root,
    LANG: "C",
    LC_ALL: "C",
    TZ: "UTC",
    TMPDIR: root,
  };
}

function findPostgresBinaries() {
  // Resolution is performed once; all subsequent execution uses these
  // absolute paths rather than PATH lookup.
  const lookupPath = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
  const found = {};
  for (const name of ["postgres", "initdb", "pg_ctl"]) {
    const result = spawnSync("/bin/sh", ["-c", "command -v \"$1\"", "sh", name], {
      encoding: "utf8",
      env: { PATH: lookupPath, LANG: "C", LC_ALL: "C" },
    });
    const binary = result.status === 0 ? result.stdout.trim() : "";
    if (!path.isAbsolute(binary) || !fs.existsSync(binary)) {
      throw new Error("required PostgreSQL binary was not available");
    }
    found[name] = fs.realpathSync(binary);
  }
  return Object.freeze(found);
}

function throwIfInterrupted(operation) {
  if (operation?.interrupted) throw new Error("ephemeral test launch interrupted");
}

async function runOwnedCommand(binary, args, env, operation) {
  throwIfInterrupted(operation);
  if (operation) operation.unverifiedCommandSpawned = true;
  const child = spawn(binary, args, {
    env,
    detached: true,
    stdio: "ignore",
  });
  const record = trackOwnedProcess(child);
  if (operation) {
    operation.command = record;
    operation.unverifiedCommandSpawned = false;
  }
  try {
    const [code, signal] = await once(child, "close");
    throwIfInterrupted(operation);
    if (code !== 0) {
      throw new Error(`owned PostgreSQL command failed (${signal ? "signal" : "nonzero exit"})`);
    }
  } finally {
    if (operation?.command === record) operation.command = null;
  }
}

async function runPureSafetyTests(safePath) {
  const child = spawn(process.execPath, [
    "--import", "./tests/safety/offline-lockdown.mjs",
    "--test",
    "tests/test-safety.unit.test.mjs",
    "tests/session-security.unit.test.mjs",
    "tests/offline-boundary.unit.test.mjs",
    // normal-route-harness-guard.unit.test.mjs guards the evidence-search
    // harness, which is not ported to this app (supporter scope only).
  ], {
    cwd: process.cwd(),
    env: {
      PATH: safePath,
      HOME: "/nonexistent",
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
    },
    stdio: "ignore",
  });
  const [code, signal] = await once(child, "close");
  if (code !== 0) {
    throw new Error(`pure safety checks failed (${signal ? "signal" : "nonzero exit"})`);
  }
}

function finalizeNormalRouteReport() {
  const report = JSON.parse(fs.readFileSync(NORMAL_ROUTE_JSON, "utf8"));
  if (report?.schemaVersion !== "normal-route-verification-v1"
    || report?.isolatedStorage?.status !== "pending_launcher_cleanup"
    || report?.summary?.cases !== 20
    || report?.summary?.providerCalls !== 0) {
    throw new Error("normal-route report was not safe to finalize");
  }
  report.isolatedStorage = {
    status: "destroyed",
    destroyed: true,
    retainedPath: null,
  };
  const jsonTemporary = `${NORMAL_ROUTE_JSON}.next`;
  fs.writeFileSync(jsonTemporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(jsonTemporary, NORMAL_ROUTE_JSON);
  const rows = report.outcomes.map((item) =>
    `| ${item.id} | ${item.routeStatus} | ${item.classification} | ${item.groupStatuses.join(", ") || "—"} | ${item.providerSpy} |`,
  ).join("\n");
  const markdown = `# Normal-route verification results

- Scope: owned-loopback private prototype HTTP answer handler and normal-gated answer service; not deployed application integration
- Cases: ${report.summary.cases} (${report.summary.passed} passed)
- External provider calls: ${report.summary.providerCalls}
- Model cost: $0
- Isolated PostgreSQL storage: destroyed after owned-process shutdown
- Imported corpus: E01–E04 originals, ${report.boundaries.importedPreparedUnits} prepared units
- Publication/review state: draft and unapproved before and after

| Case | Route status | Classification | Group statuses | Provider spy |
|---|---|---|---|---|
${rows}

## Boundaries and limitations

${report.limitations.map((item) => `- ${item}`).join("\n")}

## Commands

${report.commands.map((item) => `- \`${item}\``).join("\n")}

## Source hashes

${Object.entries(report.sourceHashesAfter).map(([file, hash]) => `- ${file}: \`${hash}\``).join("\n")}
`;
  const markdownTemporary = `${NORMAL_ROUTE_MARKDOWN}.next`;
  fs.writeFileSync(markdownTemporary, markdown, { mode: 0o600 });
  fs.renameSync(markdownTemporary, NORMAL_ROUTE_MARKDOWN);
}

async function chooseUnusedLoopbackPort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === "string" || !Number.isInteger(address.port)) {
    throw new Error("could not allocate an ephemeral loopback port");
  }
  return address.port;
}

function processHasSocketInode(pid, inode) {
  try {
    return fs.readdirSync(`/proc/${pid}/fd`).some((fd) => {
      try {
        return fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === `socket:[${inode}]`;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function tcpListenerInode(port) {
  const endpoint = `0100007F:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  try {
    for (const line of fs.readFileSync("/proc/net/tcp", "utf8").trim().split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields[1] === endpoint && fields[3] === "0A" && /^\d+$/.test(fields[9] || "")) return fields[9];
    }
  } catch {
    // The caller treats a missing proc record as unverified ownership.
  }
  return null;
}

function unixListenerInode(socketFile) {
  try {
    for (const line of fs.readFileSync("/proc/net/unix", "utf8").trim().split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields.at(-1) === socketFile && /^\d+$/.test(fields[6] || "")) return fields[6];
    }
  } catch {
    // The caller treats a missing proc record as unverified ownership.
  }
  return null;
}

function assertOwnedPostgresListener({ owned, dataDirectory, socketDirectory, port }) {
  if (!owned || currentStartTime(owned.pid) !== owned.startTime) {
    throw new Error("ephemeral PostgreSQL process ownership changed");
  }
  const pidFile = path.join(dataDirectory, "postmaster.pid");
  const dataStat = fs.statSync(dataDirectory);
  const pidStat = fs.statSync(pidFile);
  const lines = fs.readFileSync(pidFile, "utf8").split("\n");
  if (
    !dataStat.isDirectory()
    || dataStat.uid !== process.getuid()
    || fs.realpathSync(dataDirectory) !== dataDirectory
    || !pidStat.isFile()
    || pidStat.uid !== process.getuid()
    || lines[0] !== String(owned.pid)
    || path.resolve(lines[1] || "") !== dataDirectory
    || lines[3] !== String(port)
    || lines[4] !== socketDirectory
  ) {
    throw new Error("ephemeral PostgreSQL pid file did not match its owned configuration");
  }
  const tcpInode = tcpListenerInode(port);
  const socketFile = path.join(socketDirectory, `.s.PGSQL.${port}`);
  const unixInode = unixListenerInode(socketFile);
  const socketStat = fs.lstatSync(socketFile);
  if (
    !tcpInode
    || !unixInode
    || !socketStat.isSocket()
    || socketStat.uid !== process.getuid()
    || (socketStat.mode & 0o077) !== 0
    || !processHasSocketInode(owned.pid, tcpInode)
    || !processHasSocketInode(owned.pid, unixInode)
  ) {
    throw new Error("ephemeral PostgreSQL listener could not be proven owned");
  }
}

async function waitForOwnedPostgres(configuration, operation) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    throwIfInterrupted(operation);
    if (configuration.owned.child.exitCode !== null) {
      throw new Error("ephemeral PostgreSQL exited before listener verification");
    }
    try {
      assertOwnedPostgresListener(configuration);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`ephemeral PostgreSQL listener verification timed out: ${safeFailure(lastError)}`);
}

async function applySchema(config, operation) {
  // pg resolves the password from this mode-0600 file. The password is never
  // placed in a connection string, command argument, or diagnostic.
  const oldPassfile = process.env.PGPASSFILE;
  const oldHome = process.env.HOME;
  process.env.PGPASSFILE = config.pgpassFile;
  process.env.HOME = config.root;
  try {
    throwIfInterrupted(operation);
    const { Client } = await import("pg");
    const client = new Client({
      host: "127.0.0.1",
      port: config.port,
      user: config.username,
      database: config.databaseName,
      ssl: false,
      connectionTimeoutMillis: 5_000,
    });
    if (operation) operation.schemaClient = client;
    try {
      await client.connect();
      throwIfInterrupted(operation);
      const schema = await import("./safety/ephemeral-schema.mts");
      if (typeof schema.generateEphemeralSchemaSql !== "function") {
        throw new Error("ephemeral schema worker did not expose SQL generation");
      }
      const sql = await schema.generateEphemeralSchemaSql();
      if (typeof sql !== "string" || !sql.trim()) throw new Error("ephemeral schema worker returned no SQL");
      throwIfInterrupted(operation);
      await client.query(sql);
      throwIfInterrupted(operation);
    } finally {
      await client.end().catch(() => {});
      if (operation?.schemaClient === client) operation.schemaClient = null;
    }
  } finally {
    if (oldPassfile === undefined) delete process.env.PGPASSFILE;
    else process.env.PGPASSFILE = oldPassfile;
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
  }
}

function removeOwnedRoot(root) {
  if (!isOwnedEphemeralDirectory(root)) throw new Error("refusing to remove a non-ephemeral directory");
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
    throw new Error("refusing to remove an unverified ephemeral directory");
  }
  if (fs.realpathSync(root) !== root) throw new Error("refusing to remove a redirected ephemeral directory");
  fs.rmSync(root, { recursive: true, force: false, maxRetries: 2 });
}

export async function runEphemeralTests(requestedGroups = process.argv.slice(2)) {
  assertEphemeralCallerEnvironment(process.env);
  if (process.platform !== "linux") throw new Error("ephemeral PostgreSQL tests require Linux /proc ownership checks");
  const selectedGroups = normalizeManagedGroups(requestedGroups);
  const safePath = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
  console.info("ephemeral stage: pure safety checks starting");
  await runPureSafetyTests(safePath);
  console.info("ephemeral stage: pure safety checks passed");

  const root = fs.mkdtempSync("/tmp/ephemeral-postgres-");
  fs.chmodSync(root, 0o700);
  const dataDirectory = path.join(root, "data");
  const socketDirectory = path.join(root, "socket");
  const pgpassFile = path.join(root, "pgpass");
  const initPasswordFile = path.join(root, "initdb-password");
  const username = `test_owner_${randomBytes(8).toString("hex")}`;
  const password = randomBytes(32).toString("base64url");
  const databaseName = "postgres";
  let ownedPostgres = null;
  let postgresSpawned = false;
  let cleaned = false;
  let normalRouteCompleted = false;
  const operation = {
    interrupted: false,
    command: null,
    schemaClient: null,
    unverifiedCommandSpawned: false,
    cleanupState: null,
  };

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    let stopError = null;
    if (ownedPostgres) {
      try {
        await stopOwnedProcess(ownedPostgres);
      } catch (error) {
        stopError = error;
      }
    } else if (postgresSpawned || operation.unverifiedCommandSpawned) {
      // Do not guess at a PID or remove a data directory if process identity
      // could not be recorded immediately after spawn.
      stopError = new Error("ephemeral PostgreSQL ownership was not established");
    }
    try {
      const decision = cleanupDecision({
        unverifiedSpawned: operation.unverifiedCommandSpawned,
        managedResidual: Boolean(operation.cleanupState?.managedResidual),
        activeOperation: Boolean(operation.command || operation.schemaClient),
      });
      if (stopError || decision !== "remove") throw stopError || new Error("owned cleanup was not confirmed");
      removeOwnedRoot(root);
      console.info("ephemeral cleanup: complete");
    } catch (error) {
      // The only retained path is the generated /tmp ownership boundary. It
      // deliberately contains no URL, port, user, or password.
      console.error(`ephemeral cleanup retained owned residual: ${root}`);
      throw error;
    }
  };

  const onSignal = () => {
    // Do not race deletion against initdb, schema SQL, or an app child. Mark
    // the operation interrupted, stop only a tracked owned command/client,
    // then let normal control flow reach the single ordered finally cleanup.
    operation.interrupted = true;
    if (operation.cleanupState) operation.cleanupState.interrupted = true;
    const plan = interruptionPlan({
      hasOwnedCommand: Boolean(operation.command),
      hasSchemaClient: Boolean(operation.schemaClient),
    });
    if (plan.stopOwnedCommand) void stopOwnedProcess(operation.command).catch(() => {});
    if (plan.closeSchemaClient) void operation.schemaClient?.end().catch(() => {});
    process.exitCode = 130;
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  process.once("SIGHUP", onSignal);

  try {
    assertOwnedEphemeralLayout({ root, dataDirectory, socketDirectory, pgpassFile });
    privateDirectory(socketDirectory);
    const binaries = findPostgresBinaries();
    const binaryDirectory = path.dirname(binaries.postgres);
    const processEnvironment = sanitizedProcessEnvironment(root, binaryDirectory);
    privateFile(initPasswordFile, `${password}\n`);
    await runOwnedCommand(binaries.initdb, [
      "--pgdata", dataDirectory,
      "--username", username,
      "--pwfile", initPasswordFile,
      "--auth-host", "scram-sha-256",
      "--auth-local", "scram-sha-256",
      "--no-instructions",
    ], processEnvironment, operation);
    throwIfInterrupted(operation);
    fs.rmSync(initPasswordFile, { force: true });

    throwIfInterrupted(operation);
    const port = await chooseUnusedLoopbackPort();
    const hbaFile = path.join(root, "pg_hba.conf");
    const configFile = path.join(root, "postgresql.conf");
    privateFile(hbaFile, [
      "local all all scram-sha-256",
      "host all all 127.0.0.1/32 scram-sha-256",
    ].join("\n") + "\n");
    privateFile(configFile, [
      "listen_addresses = '127.0.0.1'",
      `port = ${port}`,
      `unix_socket_directories = '${socketDirectory.replaceAll("'", "''")}'`,
      "unix_socket_permissions = '0700'",
      `hba_file = '${hbaFile.replaceAll("'", "''")}'`,
      "password_encryption = 'scram-sha-256'",
      "logging_collector = off",
      "log_connections = off",
      "fsync = off",
      "synchronous_commit = off",
      "full_page_writes = off",
    ].join("\n") + "\n");
    privateFile(pgpassFile, `127.0.0.1:${port}:${databaseName}:${username}:${password}\n`);

    throwIfInterrupted(operation);
    postgresSpawned = true;
    const postgres = spawn(binaries.postgres, [
      "-D", dataDirectory,
      "-c", `config_file=${configFile}`,
    ], {
      env: processEnvironment,
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
    });
    ownedPostgres = trackOwnedProcess(postgres);
    const ownedConfig = { owned: ownedPostgres, dataDirectory, socketDirectory, port };
    await waitForOwnedPostgres(ownedConfig, operation);

    const databaseUrl = `postgresql://${username}@127.0.0.1:${port}/${databaseName}?sslmode=disable`;
    const cleanupState = { interrupted: false, managedResidual: false };
    operation.cleanupState = cleanupState;
    const config = Object.freeze({
      ephemeral: true,
      root,
      pgpassFile,
      databaseUrl,
      databaseName,
      fingerprint: databaseTargetFingerprint(databaseUrl),
      safePath,
      cleanupState,
    });
    await applySchema({ ...config, username, port }, operation);
    throwIfInterrupted(operation);
    // The isolated prototype is explicitly forbidden from evaluating or
    // launching the normal application. Its owned lifecycle proof uses the
    // same minimal prototype bootstrap (not server/index.ts) before the
    // browser group starts its separately owned server.
    const prototypeOnly = selectedGroups.length === 1 && selectedGroups[0] === "evidence-prototype";
    const normalRouteOnly = selectedGroups.length === 1 && selectedGroups[0] === "normal-route-verification";
    if (prototypeOnly) {
      console.info("ephemeral stage: prototype lifecycle starting");
      await runManagedTests(["evidence-prototype-lifecycle"], config);
      throwIfInterrupted(operation);
      console.info("ephemeral stage: prototype lifecycle passed");
    } else if (normalRouteOnly) {
      console.info("ephemeral stage: normal-route dedicated lifecycle starting");
      await runManagedTests(["normal-route-lifecycle"], config);
      throwIfInterrupted(operation);
      console.info("ephemeral stage: normal-route dedicated lifecycle passed");
    } else {
      console.info("ephemeral stage: lifecycle starting");
      await runManagedTests(["lifecycle"], config);
      throwIfInterrupted(operation);
      console.info("ephemeral stage: lifecycle passed");
    }
    const testGroups = selectedGroups.filter((group) => group !== "lifecycle");
    if (testGroups.length) {
      console.info("ephemeral stage: managed suites starting");
      await runManagedTests(testGroups, config);
      throwIfInterrupted(operation);
      console.info("ephemeral stage: managed suites passed");
    }
    normalRouteCompleted = normalRouteOnly;
  } catch (error) {
    throw new Error(`ephemeral tests failed: ${safeFailure(error, [password])}`);
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    process.off("SIGHUP", onSignal);
    await cleanup();
  }
  if (normalRouteCompleted) finalizeNormalRouteReport();
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    await runEphemeralTests();
  } catch (error) {
    console.error(safeFailure(error));
    process.exitCode = 1;
  }
}