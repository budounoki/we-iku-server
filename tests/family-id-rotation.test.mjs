// Tests for legacy familyId detection + secure rotation
// (server/familyIdMigration.ts).
//
// Policy under test:
//  1. /api/family/id-status flags legacy-format IDs (family-<=10 base36 chars)
//     and does not flag secure ones.
//  2. /api/family/rotate-id only accepts legacy IDs, renames every row
//     carrying the old family_id, and records an old->new mapping.
//  3. After rotation, id-status on the old ID discloses the mapping (grace
//     window) and the rotated family's data is reachable under the new ID.
//  4. Rotation is idempotent: rotating the same old ID again returns the same
//     new ID instead of splitting the family.
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

// A legacy-looking ID unique per run (Date.now().toString(36) is 8 chars).
const LEGACY = `family-${Date.now().toString(36)}`;
const SECURE_RE = /^family-[0-9a-f]{20}$/;

// --- 1. id-status detection ---
let r = await api("GET", `/api/family/id-status?familyId=${LEGACY}`);
check("id-status flags legacy ID", r.status === 200 && r.json?.legacy === true && r.json?.migrated === false, JSON.stringify(r.json));

r = await api("GET", `/api/family/id-status?familyId=family-${"a".repeat(20)}`);
check("id-status does not flag secure ID", r.status === 200 && r.json?.legacy === false, JSON.stringify(r.json));

r = await api("GET", `/api/family/id-status`);
check("id-status without familyId -> 400", r.status === 400, `got ${r.status}`);

// --- 2. rotate-id rejects non-legacy / missing IDs ---
r = await api("POST", "/api/family/rotate-id", {});
check("rotate without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api("POST", "/api/family/rotate-id", { familyId: `family-${"a".repeat(20)}` });
check("rotate secure ID -> 400", r.status === 400, `got ${r.status}`);

r = await api("POST", "/api/family/rotate-id", { familyId: "default" });
check("rotate 'default' -> 400", r.status === 400, `got ${r.status}`);

// --- 3. rotation moves data and records the mapping ---
r = await api("POST", "/api/logs", { familyId: LEGACY, userId: "papa", type: "diaper", subType: "pee", message: "rotation test" });
check("seed log under legacy ID -> 201", r.status === 201, `got ${r.status}`);
const logId = r.json?.id;

r = await api("POST", "/api/family/rotate-id", { familyId: LEGACY });
check("rotate legacy ID -> 200 with secure newFamilyId", r.status === 200 && SECURE_RE.test(r.json?.newFamilyId || ""), JSON.stringify(r.json));
const NEW_ID = r.json?.newFamilyId;

r = await api("GET", `/api/family/id-status?familyId=${LEGACY}`);
check("id-status on old ID discloses mapping within grace window", r.status === 200 && r.json?.migrated === true && r.json?.migratedTo === NEW_ID, JSON.stringify(r.json));

r = await api("GET", `/api/logs/${NEW_ID}`);
check("seeded log reachable under new ID", r.status === 200 && Array.isArray(r.json) && r.json.some((l) => l.id === logId), `got ${r.status}`);

r = await api("GET", `/api/logs/${LEGACY}`);
check("old ID no longer returns the log", r.status === 200 && Array.isArray(r.json) && !r.json.some((l) => l.id === logId), `got ${r.status}`);

// --- 4. idempotency ---
r = await api("POST", "/api/family/rotate-id", { familyId: LEGACY });
check("second rotate returns the same new ID", r.status === 200 && r.json?.newFamilyId === NEW_ID && r.json?.alreadyMigrated === true, JSON.stringify(r.json));

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall family-id rotation tests passed");
