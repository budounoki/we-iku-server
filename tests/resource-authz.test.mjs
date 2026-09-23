// API authorization tests for non-log resources (children, events, coupons,
// health/vaccination/growth records, sleep routines, custom vaccines,
// notifications, custom quick actions).
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

const A = `test-res-authz-a-${Date.now()}`;
const B = `test-res-authz-b-${Date.now()}`;

async function create(path, body, okStatuses = [200, 201]) {
  const r = await api("POST", path, body);
  if (!okStatuses.includes(r.status)) throw new Error(`failed to create ${path}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

// --- Create victim resources in family A ---
const child = await create("/api/children", { familyId: A, name: "authz-child" });
const event = await create("/api/events", { familyId: A, title: "authz-event", date: "2026-07-30", createdBy: "papa" });
const coupon = await create("/api/coupons", { familyId: A, title: "authz-coupon", cost: 100, isCustom: true, createdBy: "papa" });
const routine = await create("/api/sleep/routines", { familyId: A, title: "authz-routine", assignee: "パパ", sortOrder: 99 });
const growth = await create("/api/growth", { familyId: A, userId: "papa", weightGrams: 5000, heightCm: 60, measuredAt: "2026-07-01" });
const health = await create("/api/health-records", { familyId: A, type: "memo", title: "authz-health" });
const vacc = await create("/api/vaccination-records", { familyId: A, vaccineId: "hib_1", administeredDate: "2026-07-01" });
const cvacc = await create("/api/custom-vaccines", { familyId: A, name: "authz-vaccine" });
const qa = await create(`/api/families/${A}/custom-quick-actions`, { label: "authz-qa" });

// helper for the common trio: cross-family 403, missing familyId 400, owner OK
async function trio(name, fn) {
  let r = await fn(B);
  check(`${name} cross-family -> 403`, r.status === 403, `got ${r.status} ${JSON.stringify(r.json)}`);
  r = await fn(null);
  check(`${name} no familyId -> 400`, r.status === 400, `got ${r.status}`);
}
const q = (fid) => (fid ? `?familyId=${encodeURIComponent(fid)}` : "");

// --- Children ---
await trio("POST /api/children/:id", (f) => api("POST", `/api/children/${child.id}`, f ? { familyId: f, name: "hacked" } : { name: "hacked" }));
await trio("DELETE /api/children/:id", (f) => api("DELETE", `/api/children/${child.id}${q(f)}`));

// --- Events ---
await trio("POST /api/events/:id", (f) => api("POST", `/api/events/${event.id}`, f ? { familyId: f, title: "hacked" } : { title: "hacked" }));
await trio("POST /api/events/:id/complete", (f) => api("POST", `/api/events/${event.id}/complete`, f ? { familyId: f, completedBy: "papa" } : { completedBy: "papa" }));
await trio("DELETE /api/events/:id", (f) => api("DELETE", `/api/events/${event.id}${q(f)}`));

// --- Coupons ---
await trio("POST /api/coupons/:id/update", (f) => api("POST", `/api/coupons/${coupon.id}/update`, f ? { familyId: f, title: "hacked" } : { title: "hacked" }));
await trio("DELETE /api/coupons/:id", (f) => api("DELETE", `/api/coupons/${coupon.id}${q(f)}`));

// --- Sleep routines ---
await trio("POST /api/sleep/routines/:id", (f) => api("POST", `/api/sleep/routines/${routine.id}`, f ? { familyId: f, title: "hacked" } : { title: "hacked" }));
await trio("DELETE /api/sleep/routines/:id", (f) => api("DELETE", `/api/sleep/routines/${routine.id}${q(f)}`));

// --- Growth records ---
await trio("PATCH /api/growth/:id", (f) => api("PATCH", `/api/growth/${growth.id}`, f ? { familyId: f, weightGrams: 1 } : { weightGrams: 1 }));
await trio("DELETE /api/growth/:id", (f) => api("DELETE", `/api/growth/${growth.id}${q(f)}`));

// --- Health records ---
await trio("POST /api/health-records/:id/update", (f) => api("POST", `/api/health-records/${health.id}/update`, f ? { familyId: f, title: "hacked" } : { title: "hacked" }));
await trio("DELETE /api/health-records/:id", (f) => api("DELETE", `/api/health-records/${health.id}${q(f)}`));

// --- Vaccination records ---
await trio("POST /api/vaccination-records/:id/update", (f) => api("POST", `/api/vaccination-records/${vacc.id}/update`, f ? { familyId: f, note: "hacked" } : { note: "hacked" }));
await trio("DELETE /api/vaccination-records/:id", (f) => api("DELETE", `/api/vaccination-records/${vacc.id}${q(f)}`));

// --- Custom vaccines ---
await trio("DELETE /api/custom-vaccines/:id", (f) => api("DELETE", `/api/custom-vaccines/${cvacc.id}${q(f)}`));

// --- Custom quick actions (familyId from path) ---
let r = await api("DELETE", `/api/families/${B}/custom-quick-actions/${qa.id}`);
check("DELETE custom-quick-actions cross-family -> 403", r.status === 403, `got ${r.status}`);

// --- Victim data must be intact ---
r = await api("GET", `/api/children/${A}`);
check("child intact", Array.isArray(r.json) && r.json.some((c) => c.id === child.id && c.name === "authz-child"));
r = await api("GET", `/api/events/${A}`);
check("event intact & not completed", r.json.some((e) => e.id === event.id && e.title === "authz-event" && !e.completed));
r = await api("GET", `/api/coupons/${A}`);
check("coupon intact", r.json.some((c) => c.id === coupon.id && c.title === "authz-coupon"));
r = await api("GET", `/api/growth/${A}`);
check("growth record intact", r.json.some((g) => g.id === growth.id && g.weightGrams === 5000));
r = await api("GET", `/api/health-records/${A}`);
check("health record intact", r.json.some((h) => h.id === health.id && h.title === "authz-health"));
r = await api("GET", `/api/vaccination-records/${A}`);
check("vaccination record intact", r.json.some((v) => v.id === vacc.id));

// --- Notifications (thanks log creates one for mama) ---
await api("POST", "/api/logs", { familyId: A, userId: "papa", type: "thanks", message: "ありがとう" });
r = await api("GET", `/api/notifications/${A}/mama`);
const notif = r.json?.[0];
if (notif) {
  r = await api("POST", `/api/notifications/${notif.id}/read?familyId=${B}`);
  check("notification read cross-family -> 403", r.status === 403, `got ${r.status}`);
  r = await api("POST", `/api/notifications/${notif.id}/read?familyId=${A}`);
  check("notification read by owner -> 200", r.status === 200, `got ${r.status}`);
} else {
  check("notification created for test", false, "no notification found");
}

// --- Owner operations succeed ---
r = await api("POST", `/api/children/${child.id}`, { familyId: A, name: "authz-child-2" });
check("owner update child -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/events/${event.id}?familyId=${A}`);
check("owner delete event -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/coupons/${coupon.id}?familyId=${A}`);
check("owner delete coupon -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/sleep/routines/${routine.id}?familyId=${A}`);
check("owner delete routine -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/growth/${growth.id}?familyId=${A}`);
check("owner delete growth -> 2xx", r.status === 200 || r.status === 204, `got ${r.status}`);
r = await api("DELETE", `/api/health-records/${health.id}?familyId=${A}`);
check("owner delete health -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/vaccination-records/${vacc.id}?familyId=${A}`);
check("owner delete vaccination -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/custom-vaccines/${cvacc.id}?familyId=${A}`);
check("owner delete custom vaccine -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/families/${A}/custom-quick-actions/${qa.id}`);
check("owner delete quick action -> 200", r.status === 200, `got ${r.status}`);
r = await api("DELETE", `/api/children/${child.id}?familyId=${A}`);
check("owner delete child -> 200", r.status === 200, `got ${r.status}`);

// --- Not found ---
r = await api("DELETE", `/api/events/999999999?familyId=${A}`);
check("delete nonexistent event -> 404", r.status === 404, `got ${r.status}`);

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log("\nAll resource authorization tests passed");
