/*
 * Start the application through a direct child with a private IPC channel.
 * The application announces its actual bound port from its own listen
 * callback; a readiness request is never used to discover ownership.
 */
import { spawn } from "node:child_process";
import { stopOwnedProcess, trackOwnedProcess } from "./owned-process.mjs";

const STARTUP_TIMEOUT_MS = 60_000;

function startupDiagnosticCode(output) {
  // This intentionally returns only a fixed code. stderr can contain a
  // password-bearing URI, cookie, or application response and is never shown.
  if (/managed test authorization required/i.test(output)) return "authorization-guard";
  if (/ERR_MODULE_NOT_FOUND|Cannot find (?:module|package)/i.test(output)) return "module-resolution";
  if (/tsx/i.test(output) && /loader|import|module/i.test(output)) return "tsx-bootstrap";
  if (/DATABASE_URL must be set/i.test(output)) return "database-environment";
  return "app-exited";
}

export function spawnManagedServer(environment, lifecycle = {}, mode = "application") {
  if (!["application", "evidence-prototype", "evidence-prototype-lifecycle", "evidence-prototype-draft"].includes(mode)) {
    throw new Error("managed application startup: invalid-listener");
  }
  const checkEvidencePrivacy = environment.EVIDENCE_SEARCH_ENABLED === "true";
  const privacyCanary = "EVIDENCE_PRIVATE_LOG_CANARY";
  let evidencePrivacyLeak = false;
  function canaryScanner() {
    let tail = "";
    return (chunk) => {
      const text = tail + String(chunk);
      if (text.includes(privacyCanary)) evidencePrivacyLeak = true;
      tail = text.slice(-privacyCanary.length);
    };
  }
  const child = spawn(
    process.execPath,
    [
      "--import", "tsx",
      mode === "evidence-prototype" || mode === "evidence-prototype-lifecycle" || mode === "evidence-prototype-draft"
        ? "tests/safety/evidence-prototype-server.mts"
        : "tests/safety/server-bootstrap.mjs",
    ],
    {
      env: {
        ...environment,
        PORT: "0",
        MANAGED_TEST_SERVER_IPC: "1",
      },
      detached: true,
      stdio: ["ignore", checkEvidencePrivacy ? "pipe" : "ignore", "pipe", "ipc"],
    },
  );
  let stderr = "";
  // Observe only a fixed fictional marker, never emit raw server output.
  if (checkEvidencePrivacy) {
    child.stdout.on("data", canaryScanner());
    child.stderr.on("data", canaryScanner());
  }
  child.stderr.on("data", (chunk) => {
    if (stderr.length < 4096) stderr += chunk.toString("utf8").slice(0, 4096 - stderr.length);
  });
  // Tell the parent about the detached child before any asynchronous startup
  // wait. If identity capture fails, it can retain its context/root instead
  // of deleting around a potentially live process.
  lifecycle.onRecord?.(Object.freeze({ unverified: true, pid: child.pid || null }));
  let record;
  try {
    record = trackOwnedProcess(child);
    lifecycle.onRecord?.(record);
  } catch {
    lifecycle.onResidual?.();
    throw new Error("managed server ownership was not established");
  }
  const stop = async () => {
    try {
      await stopOwnedProcess(record);
    } catch {
      lifecycle.onResidual?.();
      throw new Error("managed server cleanup was not confirmed");
    }
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("managed application startup: timeout")), STARTUP_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      void stop().then(
        () => reject(error),
        () => reject(new Error("managed server startup cleanup was not confirmed")),
      );
    };
    const finish = (error, result) => {
      if (error) {
        fail(error);
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onMessage = (message) => {
      if (
        !message
        || message.type !== "managed-server-listening"
        || message.pid !== child.pid
        || !Number.isInteger(message.port)
        || message.port < 1
        || message.port > 65_535
      ) {
        finish(new Error("managed application startup: invalid-listener"));
        return;
      }
      finish(null, {
        child,
        baseURL: `http://127.0.0.1:${message.port}`,
        getDiagnosticCode: () => startupDiagnosticCode(stderr),
        hasEvidencePrivacyLeak: () => evidencePrivacyLeak,
        // Callers which start an additional managed server must await this
        // exact ownership-checked stop instead of signalling a bare PID.
        stop,
      });
    };
    const onError = () => finish(new Error("managed application startup: spawn-error"));
    const onExit = () => finish(new Error(`managed application startup: ${startupDiagnosticCode(stderr)}`));

    child.on("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}
