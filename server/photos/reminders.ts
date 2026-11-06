/**
 * 写真のおしらせ（毎日の1枚カレンダー）— ランダム時刻・1日1回・音なし。
 *
 * originwebapp server/photos/scheduler.ts（PWA 版）の規則を、AWS 側の配信経路
 * （Expo プッシュ、宛先 users.push_token）に合わせて移植したもの。
 *
 * - 日本時間の毎日 12:00〜19:59 から、ユーザーごとにランダムな分を 1 つ選び、
 *   photo_notification_jobs に保存する（その日の最初の判定＝通常は 0 時台）。
 *   再判定・再起動で引き直さない。前日の予定と同じ分は避ける。
 * - 予定時刻を過ぎた最初の判定で送る。20:00 以降は送らず、翌日に持ち越さない。
 * - 送らない: 当日の写真が全員分ある／通知オフ／当日送信済み／ママ・パパ以外。
 *   双子・兄弟は 1 人でも未撮影なら対象。送る直前にも再確認する。
 * - 寝かしつけ中（家族の誰かがネントレのタイマー作動中）は 30 分後に再判定
 *   （next_check_at に保存）。睡眠記録の「睡眠中」は見ない。
 * - 二重送信防止: 行ロック＋状態遷移（pending→sending→sent）＋当日ログ確認＋
 *   アドバイザリーロック。届いたか不明な送信は再送しない（赤ちゃんを二度起こすより安全）。
 *
 * 他の通知・記録・予測には触れない。送信は .env の PHOTO_REMINDERS_ENABLED=true のときだけ。
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { photoChildren } from "./access";
import { chooseRandomTime, dayEnd, jstDate, photoMessage, sendWindowOpen } from "./policy";
import { sendPhotoReminderPush } from "../push";

type Sender = typeof sendPhotoReminderPush;
type Target = { childId: number; childName: string };

const SETTLING_DEFER_MS = 30 * 60 * 1000;

/** 送ってよいかの判定。null = 送らない、"settling" = 30 分延期。 */
async function evaluate(db: PoolClient, uid: number, now: Date): Promise<Target | "settling" | null> {
  if (!sendWindowOpen(now)) return null;
  const user = (await db.query(
    `SELECT u.role, u.push_token, coalesce(s.enabled, true) AS enabled
       FROM users u LEFT JOIN photo_notification_settings s ON s.user_id = u.id WHERE u.id = $1`, [uid])).rows[0];
  if (!user?.enabled || (user.role !== "papa" && user.role !== "mama") || !user.push_token) return null;
  const children = (await photoChildren(db, uid)).filter(c => c.can_edit);
  if (!children.length) return null;
  // 共有している家族の誰か（ママ・パパ）が寝かしつけ中なら延期。
  const busy = await db.query(
    `SELECT 1 FROM photo_activity a JOIN parent_access p ON p.user_id = a.user_id
      WHERE p.family_id = ANY($1::text[]) AND p.verified_at IS NOT NULL AND a.settling_until > $2 LIMIT 1`,
    [Array.from(new Set(children.map(c => c.family_id))), now]);
  if (busy.rowCount) return "settling";
  const today = jstDate(now);
  for (const child of children) {
    const exists = await db.query(
      "SELECT 1 FROM baby_photos WHERE baby_id = $1 AND photo_date = $2 AND deleted_at IS NULL LIMIT 1", [child.id, today]);
    if (!exists.rowCount) return { childId: child.id, childName: child.name };
  }
  return null;
}

const clock = async (db: PoolClient, testClock?: () => Date) =>
  testClock ? testClock() : (await db.query("SELECT clock_timestamp() AS now")).rows[0].now as Date;

/** 1 ユーザー分の処理（予定の作成 → 判定 → 送信）。 */
async function processUser(db: PoolClient, uid: number, send: Sender, testClock?: () => Date) {
  await db.query("BEGIN");
  const now = await clock(db, testClock);
  const today = jstDate(now);
  if (now >= dayEnd(now)) { await db.query("COMMIT"); return; }

  // 同じ日本時間の日付に送信済みなら終わり（どの経路・端末で送ったものでも）。
  const sentToday = await db.query(
    `SELECT 1 FROM photo_notification_logs WHERE user_id = $1
        AND (sent_at AT TIME ZONE 'Asia/Tokyo')::date = $2::date LIMIT 1`, [uid, today]);
  if (sentToday.rowCount) { await db.query("COMMIT"); return; }

  let job = (await db.query(
    "SELECT * FROM photo_notification_jobs WHERE user_id = $1 AND date = $2 FOR UPDATE", [uid, today])).rows[0];
  if (!job) {
    const previous = (await db.query(
      "SELECT scheduled_at FROM photo_notification_jobs WHERE user_id = $1 AND date = $2::date - 1", [uid, today])).rows[0];
    const at = chooseRandomTime(now, previous?.scheduled_at ?? null);
    if (!at) { await db.query("COMMIT"); return; }
    await db.query(
      `INSERT INTO photo_notification_jobs(id, user_id, date, scheduled_at, next_check_at)
       VALUES ($1, $2, $3, $4, $4) ON CONFLICT (user_id, date) DO NOTHING`, [randomUUID(), uid, today, at]);
    // 同時に別の処理が作っていても、保存済みの予定を使う（引き直さない）。
    job = (await db.query(
      "SELECT * FROM photo_notification_jobs WHERE user_id = $1 AND date = $2 FOR UPDATE", [uid, today])).rows[0];
  }
  if (!job || job.state !== "pending" || now < job.scheduled_at || now < job.next_check_at || !sendWindowOpen(now)) {
    await db.query("COMMIT"); return;
  }

  const target = await evaluate(db, uid, now);
  if (target === "settling") {
    await db.query("UPDATE photo_notification_jobs SET next_check_at = $2 WHERE id = $1",
      [job.id, new Date(now.getTime() + SETTLING_DEFER_MS)]);
    await db.query("COMMIT"); return;
  }
  if (!target) { await db.query("COMMIT"); return; }

  // 送信中にする（この時点で他の処理・再試行はこの日の分を送れない）。
  await db.query(
    "UPDATE photo_notification_jobs SET state = 'sending', baby_id = $2, trigger_type = 'random', attempted_at = now() WHERE id = $1",
    [job.id, target.childId]);
  await db.query("COMMIT");

  // 送る直前の再確認（設定・権限・写真・寝かしつけ・20時）。
  const checkTime = await clock(db, testClock);
  const check = jstDate(checkTime) === today ? await evaluate(db, uid, checkTime) : null;
  if (check === "settling") {
    await db.query("UPDATE photo_notification_jobs SET state = 'pending', next_check_at = $2 WHERE id = $1 AND state = 'sending'",
      [job.id, new Date(checkTime.getTime() + SETTLING_DEFER_MS)]);
    return;
  }
  if (!check) {
    await db.query("UPDATE photo_notification_jobs SET state = 'pending' WHERE id = $1 AND state = 'sending'", [job.id]);
    return;
  }
  const token = (await db.query("SELECT push_token FROM users WHERE id = $1", [uid])).rows[0]?.push_token as string;
  const result = await send(token, photoMessage(check.childName), {
    type: "photo_reminder", notificationId: job.id, babyId: check.childId, date: today,
  });

  if (result === "sent") {
    await db.query("BEGIN");
    await db.query(
      `INSERT INTO photo_notification_logs(id, user_id, baby_id, sent_at, trigger_type)
       VALUES ($1, $2, $3, $4, 'random') ON CONFLICT DO NOTHING`, [job.id, uid, check.childId, checkTime]);
    await db.query("UPDATE photo_notification_jobs SET state = 'sent', baby_id = $2, sent_at = $3 WHERE id = $1",
      [job.id, check.childId, checkTime]);
    await db.query("COMMIT");
  } else if (result === "retry") {
    // Expo が受け付けなかったと確実な場合のみ、次の判定で再送できるよう戻す。
    await db.query("UPDATE photo_notification_jobs SET state = 'pending' WHERE id = $1 AND state = 'sending'", [job.id]);
  } else {
    // 届いたか不明・端末が無効: その日は再送しない。
    await db.query("UPDATE photo_notification_jobs SET state = 'uncertain' WHERE id = $1 AND state = 'sending'", [job.id]);
  }
}

export async function runPhotoReminders(pool: Pool, send: Sender = sendPhotoReminderPush, testClock?: () => Date) {
  const db = await pool.connect();
  let locked = false;
  try {
    // 複数プロセス・重なった実行でも 1 つだけが処理する。
    locked = (await db.query("SELECT pg_try_advisory_lock(891037, 2) AS locked")).rows[0].locked;
    if (!locked) return;
    const now = await clock(db, testClock);
    if (now >= dayEnd(now)) return;
    // 対象候補: ママ・パパ、通知オン（未設定はオン）、プッシュ通知の端末登録あり、
    // 今日の予定がまだ無いか未送信のもの。細かい条件は processUser で確認する。
    const { rows } = await db.query(
      `SELECT u.id FROM users u
         LEFT JOIN photo_notification_settings s ON s.user_id = u.id
         LEFT JOIN photo_notification_jobs j ON j.user_id = u.id AND j.date = $1::date
        WHERE u.role IN ('papa','mama') AND u.push_token LIKE 'ExponentPushToken[%'
          AND coalesce(s.enabled, true) AND (j.id IS NULL OR j.state = 'pending')
        ORDER BY u.id`, [jstDate(now)]);
    for (const { id } of rows) {
      try {
        await processUser(db, id, send, testClock);
      } catch {
        await db.query("ROLLBACK").catch(() => {});
        // 個人情報・トークンはログに出さない。
        console.error("[photo-reminders] processing failed for one user");
      }
    }
  } finally {
    if (locked) await db.query("SELECT pg_advisory_unlock(891037, 2)").catch(() => {});
    db.release();
  }
}

/** 毎分の定期処理。表が未適用なら何もしない（警告を 1 回だけ出す）。 */
export function startPhotoReminderScheduler(pool: Pool) {
  let busy = false;
  let warned = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const ready = (await pool.query(
        "SELECT to_regclass('public.photo_notification_jobs') IS NOT NULL AND to_regclass('public.photo_activity') IS NOT NULL AS ok")).rows[0].ok;
      if (ready) { warned = false; await runPhotoReminders(pool); }
      else if (!warned) { console.warn("[photo-reminders] migration not applied; reminders are off"); warned = true; }
    } catch {
      console.error("[photo-reminders] scheduler run failed");
    } finally { busy = false; }
  }, 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
