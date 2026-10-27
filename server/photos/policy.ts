import { z } from "zod";

/** 日本時間の今日（YYYY-MM-DD）。日付判定はすべてサーバー側・JST 基準。 */
export const jstDate = (date = new Date()) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});
