// Sleep session <-> sleep log linkage tests (寝かしつけの傾向の集計基盤).
//
// Policy under test: every route that creates a sleep log alongside a
// sleep session must persist logs.sleep_session_id so the dashboard can
// aggregate average sleep duration per settling method/location without
// timestamp-proximity heuristics.
//  1. /api/sleep-success (ねんね開始) -> log linked to the started session
//  2. /api/sleep-sessions/:id/end (タイマー完了) -> completion log linked
//  3. manual historical entry -> log linked despite createdAt != startedAt
//  4. /api/sleep-sessions/start metadata -> start log + wake inheritance
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

const FAMILY = `test-sleep-linkage-${Date.now()}`;
const FOREIGN_FAMILY = `${FAMILY}-foreign`;
const MANUAL_START_FAMILY = `${FAMILY}-manual-start`;
const NO_METADATA_FAMILY = `${FAMILY}-no-metadata`;

// --- 1. ねんね開始 (sleep-success): log must reference the new session ---
let r = await api("POST", "/api/sleep-success", {
  familyId: FAMILY,
  userId: "papa",
  elapsedMinutes: 0,
  settlingMethod: "抱っこ・トントン",
  settlingMinutes: 15,
  sleepLocation: "ベビーベッド",
});
check("POST /api/sleep-success -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
const sessionId = r.json?.session?.id;
check("sleep-success returns session id", Number.isInteger(sessionId));

let logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
let startLog = logs.find((l) => l.type === "sleep" && l.sleepSessionId === sessionId);
check("start log linked via sleepSessionId", !!startLog, JSON.stringify(logs.map((l) => [l.type, l.sleepSessionId])));
check("start log keeps settlingMethod", startLog?.settlingMethod === "抱っこ・トントン");
check("start log keeps sleepLocation", startLog?.sleepLocation === "ベビーベッド");

// --- 2. タイマー完了 (end): completion log must reference the same session ---
r = await api("POST", `/api/sleep-sessions/${sessionId}/end`, {
  familyId: FAMILY,
  userId: "papa",
  endedAt: new Date(Date.now() + 90 * 60000).toISOString(),
});
check("POST /api/sleep-sessions/:id/end -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`);
check("ended session has durationMin", (r.json?.durationMin ?? 0) > 0, JSON.stringify(r.json));

logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
const linkedLogs = logs.filter((l) => l.type === "sleep" && l.sleepSessionId === sessionId);
check("timer completion log also linked to session", linkedLogs.length >= 2, `linked=${linkedLogs.length}`);
const quickWakeLog = linkedLogs.find((l) => l.id !== startLog?.id);
check("quick-start wake inherits all settling details",
  quickWakeLog?.settlingMethod === "抱っこ・トントン"
  && quickWakeLog?.settlingMinutes === 15
  && quickWakeLog?.sleepLocation === "ベビーベッド");

// --- 3. 手入力の過去記録: createdAt(now) != startedAt(過去) でもIDでひも付く ---
const pastStart = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
r = await api("POST", "/api/sleep-sessions/manual", {
  familyId: FAMILY,
  createdBy: "mama",
  durationMin: 120,
  startedAt: pastStart,
  settlingMethod: "授乳",
  settlingMinutes: 10,
  sleepLocation: "添い寝",
});
check("POST /api/sleep-sessions/manual -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
const manualSessionId = r.json?.id;
check("manual session has durationMin 120", r.json?.durationMin === 120);

logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
const manualLog = logs.find((l) => l.type === "sleep" && l.sleepSessionId === manualSessionId);
check("manual historical log linked via sleepSessionId", !!manualLog);
check("manual log keeps settlingMethod", manualLog?.settlingMethod === "授乳");

// --- 4. タイマー開始のメタデータ: start log is inherited by partner wake ---
r = await api("POST", "/api/sleep-sessions/start", {
  familyId: FAMILY,
  createdBy: "papa",
  settlingMethod: "抱っこ",
  settlingMinutes: 12,
  sleepLocation: "ベビーベッド",
  sleepNote: "部屋を暗くした",
});
check("POST /api/sleep-sessions/start with metadata -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
const timerSessionId = r.json?.id;
check("start returns session id", Number.isInteger(timerSessionId));

logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
const timerStartLog = logs.find((l) => l.type === "sleep" && l.sleepSessionId === timerSessionId);
check("start metadata creates linked log", !!timerStartLog);
check("start log keeps minutes and note", timerStartLog?.settlingMinutes === 12 && timerStartLog?.sleepNote === "部屋を暗くした");

r = await api("POST", `/api/sleep-sessions/${timerSessionId}/end`, {
  familyId: FOREIGN_FAMILY,
});
check("wake by foreign family is rejected", r.status === 403, `got ${r.status} ${JSON.stringify(r.json)}`);

r = await api("POST", `/api/sleep-sessions/${timerSessionId}/end`, {
  familyId: FAMILY,
  userId: "mama",
  endedAt: new Date(Date.now() + 30 * 60000).toISOString(),
});
check("partner wake without fields -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`);

logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
let timerLogs = logs.filter((l) => l.type === "sleep" && l.sleepSessionId === timerSessionId);
const inheritedWakeLog = timerLogs.find((l) => l.id !== timerStartLog?.id);
check("partner wake inherits method/location", inheritedWakeLog?.settlingMethod === "抱っこ" && inheritedWakeLog?.sleepLocation === "ベビーベッド");
check("partner wake inherits minutes/note", inheritedWakeLog?.settlingMinutes === 12 && inheritedWakeLog?.sleepNote === "部屋を暗くした");
check("wake message includes inherited metadata", inheritedWakeLog?.message?.includes("抱っこ") && inheritedWakeLog?.message?.includes("12分") && inheritedWakeLog?.message?.includes("ベビーベッド"));

r = await api("POST", `/api/sleep-sessions/${timerSessionId}/end`, {
  familyId: FAMILY,
  userId: "mama",
});
check("repeat wake returns existing session", r.status === 200 && r.json?.id === timerSessionId);
logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
timerLogs = logs.filter((l) => l.type === "sleep" && l.sleepSessionId === timerSessionId);
check("repeat wake does not duplicate logs", timerLogs.length === 2, `linked=${timerLogs.length}`);

// Explicit empty strings and zero must override inherited values rather than
// falling back to the start log.
r = await api("POST", "/api/sleep-sessions/start", {
  familyId: FAMILY,
  createdBy: "papa",
  settlingMethod: "授乳",
  settlingMinutes: 8,
  sleepLocation: "添い寝",
  sleepNote: "消灯",
});
const overrideSessionId = r.json?.id;
check("second metadata timer start -> 201", r.status === 201 && Number.isInteger(overrideSessionId), `got ${r.status} ${JSON.stringify(r.json)}`);

r = await api("POST", `/api/sleep-sessions/${overrideSessionId}/end`, {
  familyId: FAMILY,
  settlingMethod: "",
  settlingMinutes: 0,
  sleepLocation: "",
  sleepNote: "",
});
check("wake explicit clear/zero -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`);
logs = (await api("GET", `/api/logs/${FAMILY}`)).json || [];
const overrideLogs = logs.filter((l) => l.type === "sleep" && l.sleepSessionId === overrideSessionId);
const overrideWakeLog = overrideLogs.find((l) => l.id !== overrideLogs[0]?.id);
check("wake keeps explicit empty strings and zero", overrideWakeLog?.settlingMethod === "" && overrideWakeLog?.settlingMinutes === 0 && overrideWakeLog?.sleepLocation === "" && overrideWakeLog?.sleepNote === "");

// Direct timer starts are also used by older/manual clients.  Metadata should
// be persisted even when no wake request has happened yet.
r = await api("POST", "/api/sleep-sessions/start", {
  familyId: MANUAL_START_FAMILY,
  createdBy: "mama",
  settlingMethod: "トントン",
  settlingMinutes: 0,
  sleepLocation: "布団",
  sleepNote: "手動開始",
});
check("manual no-end start with metadata -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
const manualStartSessionId = r.json?.id;
logs = (await api("GET", `/api/logs/${MANUAL_START_FAMILY}`)).json || [];
const manualStartLog = logs.find((l) => l.type === "sleep" && l.sleepSessionId === manualStartSessionId);
check("manual no-end start persists metadata", manualStartLog?.settlingMethod === "トントン" && manualStartLog?.settlingMinutes === 0 && manualStartLog?.sleepLocation === "布団" && manualStartLog?.sleepNote === "手動開始");

// Omitting all optional metadata keeps the historical timer-only behavior.
r = await api("POST", "/api/sleep-sessions/start", {
  familyId: NO_METADATA_FAMILY,
  createdBy: "papa",
});
check("start without optional metadata -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`);
const noMetadataSessionId = r.json?.id;
logs = (await api("GET", `/api/logs/${NO_METADATA_FAMILY}`)).json || [];
check("start without metadata does not create a log", !logs.some((l) => l.type === "sleep" && l.sleepSessionId === noMetadataSessionId));

console.log(failures === 0 ? "\nsleep-linkage: all passed" : `\nsleep-linkage: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
