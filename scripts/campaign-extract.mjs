#!/usr/bin/env node
/**
 * キャンペーン締め切り後の抽出（ぶどうの木宿泊券 2026）。
 *
 * クライアントから受け取った識別コード一覧を、登録日時・ログイン方法・ロールに
 * 突き合わせて CSV で出力する。氏名・メールなど個人を特定できる情報は出さない。
 *
 * 使い方:
 *   node scripts/campaign-extract.mjs codes.txt > result.csv
 * codes.txt は 1行1コード（CSV の場合は先頭列をコードとして読む。ヘッダー行可）。
 * 該当するコードが無い場合は「不明」。
 */
import fs from "node:fs";
import pg from "pg";

const CAMPAIGN = "budounoki-stay-2026";
const file = process.argv[2];
if (!file) { console.error("usage: node scripts/campaign-extract.mjs codes.txt > result.csv"); process.exit(1); }

const dbUrl = process.env.DATABASE_URL
  || (fs.readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1] ?? "").replace(/^"|"$/g, "");

const codes = fs.readFileSync(file, "utf8").split(/\r?\n/)
  .map((line) => line.split(",")[0].trim().replace(/^"|"$/g, "").toUpperCase())
  .filter((code) => /^[A-HJKMNP-Z2-9]{10}$/.test(code));

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const { rows } = await client.query(
  `SELECT c.code, u.created_at, u.line_user_id, u.role,
          EXISTS (SELECT 1 FROM supporter_accounts s WHERE s.user_id = u.id AND s.is_active) AS is_supporter
     FROM campaign_codes c JOIN users u ON u.id = c.user_id
    WHERE c.campaign = $1 AND c.code = ANY($2)`,
  [CAMPAIGN, codes],
);
await client.end();

const byCode = new Map(rows.map((r) => [r.code, r]));
const jst = (d) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const login = (id) => (id?.startsWith("google_") ? "Google" : id?.startsWith("apple_") ? "Apple" : id ? "LINE" : "不明");
const role = (r) => (r.is_supporter ? "その他" : r.role === "mama" ? "ママ" : r.role === "papa" ? "パパ" : "その他");

console.log("識別コード,登録日時,ログイン方法,ロール");
for (const code of codes) {
  const r = byCode.get(code);
  console.log(r ? `${code},${jst(new Date(r.created_at))},${login(r.line_user_id)},${role(r)}` : `${code},不明,不明,不明`);
}
console.error(`${codes.length} codes, ${rows.length} matched`);
