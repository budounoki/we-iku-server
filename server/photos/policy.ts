import { z } from "zod";
import { randomInt } from "node:crypto";

/** 日本時間の今日（YYYY-MM-DD）。日付判定はすべてサーバー側・JST 基準。 */
export const jstDate = (date = new Date()) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});

/* ── 写真のおしらせ（ランダム時刻） ── originwebapp server/photos/policy.ts と同じ規則 */

/** 日本時間の 0 時からの経過分。 */
export const jstMinutes = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 9 * 3600000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};
/** その日の送信締め切り（日本時間 20:00）。これ以降は送らない・翌日に持ち越さない。 */
export const dayEnd = (now: Date) => new Date(`${jstDate(now)}T20:00:00+09:00`);
export const sendWindowOpen = (now: Date) =>
  now >= new Date(`${jstDate(now)}T12:00:00+09:00`) && now < dayEnd(now);

/**
 * 12:00〜19:59 から 1 分単位で一様に選ぶ。前日の予定と同じ分は除く。
 * 12 時を過ぎてから初めて判定した場合は、残りの時間帯から選ぶ（無ければ null）。
 * 20:00 ちょうどは、毎分の定期処理の遅れで締め切りを越えやすいため選ばない。
 */
export function chooseRandomTime(now: Date, previous: Date | null, pick = randomInt): Date | null {
  const start = new Date(`${jstDate(now)}T00:00:00+09:00`).getTime();
  const first = Math.max(720, Math.ceil((now.getTime() - start) / 60000));
  const slots: number[] = [];
  for (let minute = first; minute < 1200; minute++) {
    if (previous && jstMinutes(previous) === minute) continue;
    slots.push(minute);
  }
  return slots.length ? new Date(start + slots[pick(slots.length)] * 60000) : null;
}

/** 通知文言（4 種からランダム）。名前は当日の写真がまだない子。 */
export function photoMessage(name: string, pick = randomInt) {
  return [`📸 今日の${name}ちゃん、残しておこう`,
    "📸 1年後に見返したくなる1枚、撮っておこう",
    "📸 今日のカレンダー、まだ空いてます",
    `📸 いまの${name}ちゃん、1枚どうですか？`][pick(4)];
}
