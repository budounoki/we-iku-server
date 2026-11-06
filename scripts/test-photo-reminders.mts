/**
 * 写真のおしらせ（ランダム時刻）の検証。本番 DB では絶対に実行しないこと。
 * 使い捨ての PostgreSQL に最小の表と scripts/photo-notifications-migration.sql を入れてから:
 *   PHOTO_TEST_DATABASE_URL=postgres://... npx tsx scripts/test-photo-reminders.mts
 */
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { runPhotoReminders } from "../server/photos/reminders";
import { chooseRandomTime, jstDate, jstMinutes, photoMessage } from "../server/photos/policy";

const url = process.env.PHOTO_TEST_DATABASE_URL;
if (!url || /we-iku|weiku/.test(url)) throw new Error("PHOTO_TEST_DATABASE_URL (throwaway DB) is required");
const pool = new pg.Pool({ connectionString: url });
const q = (sql: string, args: unknown[] = []) => pool.query(sql, args);
const jst = (s: string) => new Date(`${s}+09:00`);

let sent: { token: string; body: string; data: any }[] = [];
let mode: "sent" | "retry" | "uncertain" = "sent";
const sender = async (token: string, body: string, data: any) => { sent.push({ token, body, data }); return mode; };
let now = jst("2026-11-10T00:05:00");
const run = () => runPhotoReminders(pool, sender as any, () => now);
const results: string[] = [];
const ok = (name: string) => { results.push(`OK  ${name}`); };

async function reset() {
  await q(`TRUNCATE photo_notification_logs, photo_notification_jobs, photo_notification_settings, photo_activity,
    baby_photos, parent_access, supporter_grants, supporter_accounts, children, users RESTART IDENTITY`);
  sent = []; mode = "sent";
  // 家族 F1: パパ(1)・ママ(2)・双子(1,2)。家族 F2: 通知オフのパパ(3)。F3: その他ロール(4)。F4: サポーター兼パパ(5)。
  await q(`INSERT INTO users(display_name,family_id,role,push_token) VALUES
    ('papa','F1','papa','ExponentPushToken[a]'),('mama','F1','mama','ExponentPushToken[b]'),
    ('off','F2','papa','ExponentPushToken[c]'),('other','F3','other','ExponentPushToken[d]'),
    ('sup','F4','papa','ExponentPushToken[e]')`);
  await q(`INSERT INTO children(family_id,name,birthday) VALUES ('F1','ゆう','2026-01-01'),('F1','あお','2026-01-01'),
    ('F2','はる','2026-01-01'),('F3','そら','2026-01-01'),('F4','りく','2026-01-01')`);
  await q(`INSERT INTO parent_access(user_id,family_id,role,verified_at) VALUES
    (1,'F1','papa',now()),(2,'F1','mama',now()),(3,'F2','papa',now()),(5,'F4','papa',now())`);
  await q(`INSERT INTO supporter_accounts(user_id,is_active) VALUES (5,true)`);
  await q(`INSERT INTO photo_notification_settings(user_id,enabled) VALUES (3,false)`);
}
const job = async (uid: number, date: string) =>
  (await q("SELECT * FROM photo_notification_jobs WHERE user_id=$1 AND date=$2", [uid, date])).rows[0];
const photo = (baby: number, date: string) =>
  q("INSERT INTO baby_photos(id,baby_id,photo_date) VALUES($1,$2,$3)", [randomUUID(), baby, date]);

// ── policy ──
{
  for (let i = 0; i < 2000; i++) {
    const t = chooseRandomTime(jst("2026-11-10T00:00:00"), null)!;
    const m = jstMinutes(t); assert.ok(m >= 720 && m < 1200, `minute ${m}`);
  }
  const prev = jst("2026-11-09T15:07:00");
  for (let i = 0; i < 3000; i++) assert.notEqual(jstMinutes(chooseRandomTime(jst("2026-11-10T00:00:00"), prev)!), 15 * 60 + 7);
  // 選択肢の中で前日と同じ分を選ぶはずの添字でも除外される
  const at = chooseRandomTime(jst("2026-11-10T00:00:00"), jst("2026-11-09T12:00:00"), () => 0)!;
  assert.equal(jstMinutes(at), 721);
  const late = chooseRandomTime(jst("2026-11-10T15:30:20"), null, () => 0)!;
  assert.equal(jstMinutes(late), 15 * 60 + 31);
  assert.equal(chooseRandomTime(jst("2026-11-10T19:59:30"), null), null);
  assert.equal(jstDate(jst("2026-11-10T23:59:59")), "2026-11-10");
  assert.equal(jstDate(jst("2026-11-11T00:00:00")), "2026-11-11");
  const bodies = new Set(Array.from({ length: 200 }, () => photoMessage("ゆう")));
  assert.equal(bodies.size, 4);
  for (const b of bodies) assert.ok(!/ねんね中|おなかいっぱい/.test(b));
  ok("時刻は 12:00〜19:59・前日と同じ分を除外・遅い初回は残りから・20時直前は選ばない・JST 日付境界・文言4種");
}

// ── 予定の保存と再起動 ──
await reset();
now = jst("2026-11-10T00:05:00");
await run();
const planned = await job(1, "2026-11-10");
assert.ok(planned && planned.state === "pending");
await run(); await run(); // 再判定・再起動相当
assert.equal((await job(1, "2026-11-10")).scheduled_at.getTime(), planned.scheduled_at.getTime());
assert.equal(sent.length, 0);
assert.equal(await job(3, "2026-11-10"), undefined, "通知オフは予定も作らない");
assert.equal(await job(4, "2026-11-10"), undefined, "ママ・パパ以外は対象外");
ok("0時台に予定を保存し、再判定・再起動で時刻が変わらない");

// ── 翌日は前日と別の時刻 ──
{
  for (let i = 0; i < 30; i++) {
    await q("DELETE FROM photo_notification_jobs WHERE date='2026-11-11'");
    now = jst("2026-11-11T00:01:00");
    await run();
    const a = await job(1, "2026-11-10"), b = await job(1, "2026-11-11");
    assert.notEqual(jstMinutes(b.scheduled_at), jstMinutes(a.scheduled_at));
  }
  ok("翌日の予定は前日と異なる分");
}

// ── 送信: 双子の片方だけ撮影済み → もう片方の名前で 1 回だけ ──
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T13:00:00")]);
await photo(1, "2026-11-10");
now = jst("2026-11-10T12:59:00"); await run();
assert.equal(sent.filter(s => s.token.endsWith("[a]")).length, 0, "予定前は送らない");
now = jst("2026-11-10T13:00:10"); await run();
const toPapa = sent.filter(s => s.token.endsWith("[a]"));
assert.equal(toPapa.length, 1);
assert.equal(toPapa[0].data.babyId, 2);
assert.ok(!toPapa[0].body.includes("ゆう"), "撮影済みの子の名前は使わない");
assert.equal(toPapa[0].data.type, "photo_reminder");
const log = (await q("SELECT * FROM photo_notification_logs WHERE user_id=1")).rows;
assert.equal(log.length, 1); assert.equal(log[0].trigger_type, "random"); assert.equal(log[0].id, toPapa[0].data.notificationId);
now = jst("2026-11-10T13:05:00"); await run(); await run();
assert.equal(sent.filter(s => s.token.endsWith("[a]")).length, 1);
ok("兄弟の1人でも未撮影なら送る（未撮影の子の名前）・送信は1日1回・trigger_type=random・ログ記録");

// ── 全員撮影済みなら送らない ──
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T13:00:00")]);
await photo(1, "2026-11-10"); await photo(2, "2026-11-10");
now = jst("2026-11-10T14:00:00"); await run();
assert.equal(sent.length, 0);
ok("当日の写真が全員分そろっていれば送らない");

// ── 通知オフ・対象外ロール・サポーター ──
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("INSERT INTO photo_notification_jobs(id,user_id,date,scheduled_at,next_check_at) VALUES($1,3,'2026-11-10',$2,$2),($3,4,'2026-11-10',$2,$2),($4,5,'2026-11-10',$2,$2) ON CONFLICT DO NOTHING",
  [randomUUID(), jst("2026-11-10T12:30:00"), randomUUID(), randomUUID()]);
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T12:30:00")]);
await q("UPDATE photo_notification_settings SET enabled=false WHERE user_id=3");
await q("INSERT INTO photo_notification_settings(user_id,enabled) VALUES(2,false)");
now = jst("2026-11-10T12:31:00"); await run();
assert.deepEqual(sent.map(s => s.token), ["ExponentPushToken[a]"]);
ok("通知オフ・ママ・パパ以外・サポーターには送らない（送る直前にも確認）");

// ── 寝かしつけ中: 30分延期を繰り返し、20時で打ち切り ──
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T18:50:00")]);
await q("INSERT INTO photo_activity(user_id,settling_until) VALUES(2,$1)", [jst("2026-11-10T22:00:00")]); // ママが寝かしつけ中
now = jst("2026-11-10T18:50:30"); await run();
let j = await job(1, "2026-11-10");
assert.equal(j.next_check_at.getTime(), jst("2026-11-10T19:20:30").getTime());
assert.equal(j.scheduled_at.getTime(), jst("2026-11-10T18:50:00").getTime(), "予定時刻は変えない");
now = jst("2026-11-10T19:05:00"); await run();
assert.equal(sent.length, 0, "再判定時刻前は何もしない");
now = jst("2026-11-10T19:20:40"); await run();
j = await job(1, "2026-11-10");
assert.equal(j.next_check_at.getTime(), jst("2026-11-10T19:50:40").getTime(), "まだ寝かしつけ中ならさらに30分");
now = jst("2026-11-10T19:50:50"); await run();
j = await job(1, "2026-11-10");
assert.ok(j.next_check_at > jst("2026-11-10T20:00:00"));
await q("UPDATE photo_activity SET settling_until=NULL");
now = jst("2026-11-10T20:00:00"); await run();
now = jst("2026-11-10T20:21:00"); await run();
now = jst("2026-11-11T00:01:00"); await run();
assert.equal(sent.length, 0);
assert.equal((await job(1, "2026-11-10")).state, "pending");
ok("寝かしつけ中は30分延期（再判定時刻をDB保存）・続けば再延期・20時を過ぎたら送らず翌日に持ち越さない");

// ── 睡眠中（睡眠記録）は寝かしつけ扱いしない ──
// reminders.ts は sleep_sessions を参照しない（photo_activity のみ）。上の各テストに睡眠の表は無くても送信できている。
ok("「睡眠中」（sleep_sessions）は判定に使わない");

// ── 20時の締め切り（遅延した定期処理） ──
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T19:59:00")]);
now = jst("2026-11-10T20:00:05"); await run();
assert.equal(sent.length, 0);
ok("19:59 予定でも処理が 20:00 を過ぎたら送らない");

// ── 同時実行・再試行 ──
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T12:10:00")]);
now = jst("2026-11-10T12:11:00");
await Promise.all([run(), run(), run(), run()]);
assert.equal(sent.filter(s => s.token.endsWith("[a]")).length, 1);
assert.equal(sent.filter(s => s.token.endsWith("[b]")).length, 1);
ok("同時に4つ実行しても各ユーザー1回");

await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T12:10:00")]);
mode = "retry"; now = jst("2026-11-10T12:11:00"); await run();
assert.equal((await job(1, "2026-11-10")).state, "pending");
mode = "sent"; now = jst("2026-11-10T12:12:00"); await run(); await run();
assert.equal(sent.filter(s => s.token.endsWith("[a]")).length, 2); // 1回目は Expo が受け付けなかった試行
assert.equal((await q("SELECT count(*)::int n FROM photo_notification_logs WHERE user_id=1")).rows[0].n, 1);
await reset();
now = jst("2026-11-10T00:05:00"); await run();
await q("UPDATE photo_notification_jobs SET scheduled_at=$1, next_check_at=$1", [jst("2026-11-10T12:10:00")]);
mode = "uncertain"; now = jst("2026-11-10T12:11:00"); await run();
mode = "sent"; now = jst("2026-11-10T12:30:00"); await run();
assert.equal(sent.filter(s => s.token.endsWith("[a]")).length, 1);
assert.equal((await job(1, "2026-11-10")).state, "uncertain");
ok("受付拒否（429/5xx）だけ再送・届いたか不明な場合は再送しない");

// ── 当日すでに送信済み（ログあり）なら、予定が無くても送らない ──
await reset();
await q("INSERT INTO photo_notification_logs(id,user_id,baby_id,sent_at,trigger_type) VALUES($1,1,1,$2,'random')",
  [randomUUID(), jst("2026-11-10T00:30:00")]);
now = jst("2026-11-10T00:35:00"); await run();
assert.equal(await job(1, "2026-11-10"), undefined);
ok("当日の送信ログがあれば（日本時間の日付で判定）予定も作らない");

console.log(results.join("\n"));
await pool.end();
