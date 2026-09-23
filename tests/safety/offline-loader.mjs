// An intentionally tiny import graph for the offline safety tests.
const allowedFiles = new Set([
  "../test-safety.unit.test.mjs",
  "../session-security.unit.test.mjs",
  "../offline-boundary.unit.test.mjs",
  "../normal-route-harness-guard.unit.test.mjs",
  "./policy.mjs",
  "../../server/session-security.mjs",
  // Node >=24 resolves the --import entry itself through registered hooks
  // in test-runner child processes; the lockdown bootstrap must stay loadable.
  "./offline-lockdown.mjs",
].map((relative) => new URL(relative, import.meta.url).href));
const allowedBuiltins = new Set(["node:test", "node:assert/strict", "node:crypto", "node:fs"]);

export async function resolve(specifier, context, nextResolve) {
  if (allowedBuiltins.has(specifier)) return nextResolve(specifier, context);
  let resolved;
  try {
    resolved = new URL(specifier, context.parentURL || import.meta.url).href;
  } catch {
    throw new Error("OFFLINE_IMPORT_BLOCKED");
  }
  if (!allowedFiles.has(resolved)) throw new Error("OFFLINE_IMPORT_BLOCKED");
  return nextResolve(specifier, context);
}