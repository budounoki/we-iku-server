/**
 * 写真のおしらせを 1 人だけに今すぐ送る（実機確認用）。日本時間 12:00〜19:59 のみ送れる。
 * その日の写真が全員分ある・通知オフ・push_token なし・当日送信済みの場合は送られない（通常と同じ判定）。
 *   set -a; . ./.env; set +a; npx tsx scripts/send-test-photo-reminder.mts <userId>
 */
import pg from "pg";
import { sendTestPhotoReminder } from "../server/photos/reminders";

const uid = Number(process.argv[2]);
if (!Number.isInteger(uid) || uid <= 0) throw new Error("usage: send-test-photo-reminder.mts <userId>");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log(await sendTestPhotoReminder(pool, uid));
await pool.end();
