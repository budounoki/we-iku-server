// API authorization tests for log/sleep-session mutation routes.
import "./safety/require-managed.mjs";
import { getManagedTestContext } from "./safety/require-managed.mjs";

const BASE = getManagedTestContext().baseURL;
if (!BASE) throw new Error("managed authorization server is unavailable");

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`ok   - ${name}`);
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const FAMILY_A = `test-authz-a-${Date.now()}`;
const FAMILY_B = `test-authz-b-${Date.now()}`;

async function createLog(familyId) {
  const r = await api("POST", "/api/logs", {
    familyId, userId: "papa", type: "diaper", subType: "pee", message: "authz test",
  });
  if (r.status !== 201) throw new Error(`failed to create log: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.id;
}

const victimLog = await createLog(FAMILY_A);
const attackerLog = await createLog(FAMILY_B);

// --- Cross-family access must be 403 ---
let r = await api("DELETE", `/api/logs/${victimLog}?familyId=${FAMILY_B}`);
check("DELETE /api/logs/:id cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("POST", `/api/logs/${victimLog}/update`, { familyId: FAMILY_B, message: "hacked" });
check("POST /api/logs/:id/update cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("POST", `/api/logs/${victimLog}/update-time`, { familyId: FAMILY_B, createdAt: new Date().toISOString() });
check("POST /api/logs/:id/update-time cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("PATCH", `/api/logs/${victimLog}/sleep-detail`, { familyId: FAMILY_B, sleepNote: "hacked" });
check("PATCH /api/logs/:id/sleep-detail cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("POST", "/api/logs/bulk-delete", { familyId: FAMILY_B, ids: [victimLog] });
check("POST /api/logs/bulk-delete cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("POST", "/api/logs/bulk-delete", { familyId: FAMILY_B, ids: [victimLog, attackerLog] });
check("bulk-delete mixed ids -> 403, nothing deleted", r.status === 403, `got ${r.status}`);

// --- Missing familyId must be rejected ---
r = await api("DELETE", `/api/logs/${victimLog}`);
check("DELETE without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api("POST", `/api/logs/${victimLog}/update`, { message: "x" });
check("update without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api("POST", "/api/logs/bulk-delete", { ids: [victimLog] });
check("bulk-delete without familyId -> 400", r.status === 400, `got ${r.status}`);

// --- Victim's log must still be intact ---
r = await api("GET", `/api/logs/${FAMILY_A}`);
check("victim log still exists after attacks", Array.isArray(r.json) && r.json.some((l) => l.id === victimLog));

// --- Same-family operations still work ---
r = await api("POST", `/api/logs/${victimLog}/update`, { familyId: FAMILY_A, message: "updated by owner" });
check("owner update -> 200", r.status === 200, `got ${r.status}`);

r = await api("DELETE", `/api/logs/${victimLog}?familyId=${FAMILY_A}`);
check("owner delete -> 200", r.status === 200, `got ${r.status}`);

// --- Sleep sessions ---
const s = await api("POST", "/api/sleep-success", { familyId: FAMILY_A, userId: "papa" });
if (s.status !== 201) throw new Error(`failed to create sleep session: ${s.status} ${JSON.stringify(s.json)}`);
const sessionId = s.json.session.id;
const sleepLogId = s.json.logId;

r = await api("POST", `/api/sleep-sessions/${sessionId}/end`, { familyId: FAMILY_B });
check("sleep-session end cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("POST", `/api/sleep-sessions/${sessionId}/end`, {});
check("sleep-session end without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api("POST", `/api/sleep-sessions/${sessionId}/end`, { familyId: FAMILY_A });
check("sleep-session end by owner -> 200", r.status === 200, `got ${r.status}`);

r = await api("POST", `/api/sleep-sessions/${sessionId}/update-time`, { familyId: FAMILY_B, startedAt: new Date().toISOString() });
check("sleep-session update-time cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("DELETE", `/api/sleep-sessions/${sessionId}?familyId=${FAMILY_B}`);
check("sleep-session delete cross-family -> 403", r.status === 403, `got ${r.status}`);

r = await api("DELETE", `/api/sleep-sessions/${sessionId}?familyId=${FAMILY_A}`);
check("sleep-session delete by owner -> 200", r.status === 200, `got ${r.status}`);

// --- Not found ---
r = await api("DELETE", `/api/logs/999999999?familyId=${FAMILY_A}`);
check("delete nonexistent log -> 404", r.status === 404, `got ${r.status}`);

// Cleanup attacker family's own log
await api("DELETE", `/api/logs/${attackerLog}?familyId=${FAMILY_B}`);
await api("DELETE", `/api/logs/${sleepLogId}?familyId=${FAMILY_A}`).catch(() => {});

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log("\nAll authorization tests passed");
