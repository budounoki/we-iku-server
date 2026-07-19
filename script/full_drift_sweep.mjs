// Full schema-drift audit: for every pgTable() in shared/schema.ts, compare
// the declared columns to the actual DB columns.
import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const src = fs.readFileSync('/home/ubuntu/Downloads/WeApp/shared/schema.ts', 'utf8');

// Match: export const foo = pgTable("table_name", { ... });
const tableRe = /pgTable\s*\(\s*["']([a-z0-9_]+)["']\s*,\s*\{([\s\S]*?)\}\s*\)/g;
// Match column definitions: identifier: someType("column_name" ...)
const colRe = /\b(?:serial|text|integer|boolean|timestamp|real|json|jsonb|date|varchar|char|numeric|bigint|smallint|uuid)\s*\(\s*["']([a-z0-9_]+)["']/g;

const expected = {};
let m;
while ((m = tableRe.exec(src)) !== null) {
  const table = m[1];
  const body = m[2];
  const cols = [];
  let cm;
  while ((cm = colRe.exec(body)) !== null) cols.push(cm[1]);
  colRe.lastIndex = 0;
  expected[table] = cols;
}

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

let issues = 0;
const drifts = [];
for (const [table, expCols] of Object.entries(expected)) {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]);
  const actual = r.rows.map(x => x.column_name);
  if (actual.length === 0) {
    console.log(`❌ ${table}: TABLE DOES NOT EXIST (schema declares it)`);
    drifts.push({ table, kind: 'missing_table' });
    issues++;
    continue;
  }
  const missing = expCols.filter(c => !actual.includes(c));
  const extra = actual.filter(c => !expCols.includes(c));
  if (missing.length || extra.length) {
    console.log(`⚠️  ${table}`);
    if (missing.length) console.log(`     schema→DB missing: ${missing.join(', ')}`);
    if (extra.length)   console.log(`     DB→schema extra:   ${extra.join(', ')}`);
    drifts.push({ table, missing, extra });
    issues++;
  } else {
    console.log(`✓ ${table}`);
  }
}
console.log(`\n${issues} table(s) with drift out of ${Object.keys(expected).length}`);

await pool.end();
