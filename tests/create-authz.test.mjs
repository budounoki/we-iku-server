// API authorization tests for creation routes (Task: block injecting data
// into another family's timeline).
//
// Policy under test:
//  1. Creation routes must REQUIRE an explicit familyId (400 when missing) —
//     no silent "default" family fallback.
//  2. A single IP may only write to a limited number of DISTINCT familyIds
//     per window (enumeration guard, FAMILY_ENUM_LIMIT) -> 429, while
//     already-used familyIds keep working.
//
// Part 1 runs against the server owned by the managed runner. Part 2 spawns
// its own server with FAMILY_ENUM_LIMIT=5 so the limit is testable and
// doesn't interfere with other suites.
import "./safety/require-managed.mjs";
import { getManagedTestContext, getManagedTestEnvironment } from "./safety/require-managed.mjs";
import { spawnManagedServer } from "./safety/managed-server.mjs";

const BASE = getManagedTestContext().baseURL;
if (!BASE) throw new Error("managed authorization server is unavailable");

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`ok   - ${name}`);
  else { failures++; console.error(`FAIL - ${name} ${extra}`); }
}

async function api(base, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const FAMILY = `test-create-authz-${Date.now()}`;

// --- 1. Creation without familyId must be rejected (no "default" fallback) ---
let r = await api(BASE, "POST", "/api/logs", { userId: "papa", type: "diaper", subType: "pee" });
check("POST /api/logs without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api(BASE, "POST", "/api/events", { title: "x", date: "2026-07-30" });
check("POST /api/events without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api(BASE, "POST", "/api/coupons", { title: "x", cost: 1, isCustom: true, createdBy: "papa" });
check("POST /api/coupons without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api(BASE, "POST", "/api/children", { name: "x" });
check("POST /api/children without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api(BASE, "POST", "/api/we-board", { message: "x", createdBy: "papa" });
check("POST /api/we-board without familyId -> 400", r.status === 400, `got ${r.status}`);

r = await api(BASE, "POST", "/api/logs", { familyId: "   ", userId: "papa", type: "diaper" });
check("POST /api/logs with blank familyId -> 400", r.status === 400, `got ${r.status}`);

// --- Legit creation with explicit familyId still works ---
r = await api(BASE, "POST", "/api/logs", { familyId: FAMILY, userId: "papa", type: "diaper", subType: "pee", message: "create authz test" });
check("POST /api/logs with familyId -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);

// --- Param/body mismatch on :familyId routes must be rejected (guard bypass) ---
r = await api(BASE, "POST", `/api/families/${FAMILY}-victim/food-ingredients`, {
  familyId: FAMILY, // attacker pins own id in body while targeting another family in URL
  name: "authz-mismatch", category: "その他",
});
check("param/body familyId mismatch -> 403", r.status === 403, `got ${r.status}`);

r = await api(BASE, "POST", `/api/logs?familyId=${FAMILY}-other`, { familyId: FAMILY, userId: "papa", type: "diaper", subType: "pee" });
check("body/query familyId mismatch -> 403", r.status === 403, `got ${r.status}`);

// --- 2. familyId enumeration guard (own server, FAMILY_ENUM_LIMIT=5) ---
const secondary = await spawnManagedServer(
  getManagedTestEnvironment({ FAMILY_ENUM_LIMIT: "5" }),
);
const base2 = secondary.baseURL;
try {
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base2 + "/api/logs/readiness-probe");
      if (res.status < 500) { ready = true; break; }
    } catch {}
    await new Promise((s) => setTimeout(s, 500));
  }
  if (!ready) throw new Error("enum-limit server did not become ready");

  const ids = Array.from({ length: 5 }, (_, i) => `enum-authz-${Date.now()}-${i}`);
  for (const id of ids) {
    const rr = await api(base2, "POST", "/api/logs", { familyId: id, userId: "papa", type: "diaper", subType: "pee" });
    if (rr.status !== 201) check(`warm-up create for ${id} -> 201`, false, `got ${rr.status}`);
  }
  r = await api(base2, "POST", "/api/logs", { familyId: `enum-authz-overflow-${Date.now()}`, userId: "papa", type: "diaper", subType: "pee" });
  check("6th distinct familyId from same IP -> 429", r.status === 429, `got ${r.status}`);

  r = await api(base2, "POST", "/api/events", { familyId: `enum-authz-overflow2-${Date.now()}`, title: "x", date: "2026-07-30" });
  check("enumeration blocked across routes too -> 429", r.status === 429, `got ${r.status}`);

  r = await api(base2, "POST", "/api/logs", { familyId: ids[0], userId: "papa", type: "diaper", subType: "pee" });
  check("already-seen familyId still allowed -> 201", r.status === 201, `got ${r.status}`);

  // Varying the URL :familyId while pinning a known body familyId must NOT
  // evade the limit: the param is canonical and mismatches are rejected.
  r = await api(base2, "POST", `/api/families/enum-authz-param-${Date.now()}/food-ingredients`, {
    familyId: ids[0], name: "x", category: "その他",
  });
  check("param-vs-body pinning does not bypass guard -> 403", r.status === 403, `got ${r.status}`);
  // And an unseen param familyId alone (no body pin) counts as a distinct id -> 429 (limit reached).
  r = await api(base2, "POST", `/api/families/enum-authz-param2-${Date.now()}/food-ingredients`, { name: "x", category: "その他" });
  check("unseen :familyId param counts toward enumeration limit -> 429", r.status === 429, `got ${r.status}`);
} finally {
  await secondary.stop();
}

if (failures > 0) {
  console.error(`\n${failures} creation-authz test(s) FAILED`);
  process.exit(1);
} else {
  console.log("\nall creation-authz tests passed");
}
