// Inspect overlap risk: list current users + family_ids in current and compare to backup contents.
import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

console.log('=== CURRENT users ===');
const u = await pool.query(`SELECT id, line_user_id, display_name, family_id, role, created_at FROM users ORDER BY id`);
u.rows.forEach(r => console.log(`  id=${r.id} family=${r.family_id} name=${r.display_name} line=${r.line_user_id?.slice(0,12)}... created=${r.created_at?.toISOString?.()}`));

console.log('\n=== distinct family_ids in current DB tables ===');
for (const t of ['children','settings','logs','events','growth_records','sleep_routines','coupons']) {
  try {
    const r = await pool.query(`SELECT DISTINCT family_id, COUNT(*)::int AS c FROM "${t}" GROUP BY family_id ORDER BY family_id`);
    console.log(`  ${t}:`);
    r.rows.forEach(x => console.log(`    "${x.family_id}" → ${x.c} rows`));
  } catch (e) { console.log(`  ${t} err`, e.message); }
}

console.log('\n=== max IDs (for sequence bump) ===');
for (const t of ['children','settings','logs','events','growth_records','sleep_routines','coupons','vaccination_records','notifications','sleep_sessions','sleep_checklist']) {
  try {
    const r = await pool.query(`SELECT COALESCE(MAX(id),0) AS m FROM "${t}"`);
    console.log(`  ${t}: max id = ${r.rows[0].m}`);
  } catch (e) { console.log(`  ${t} err`, e.message); }
}

await pool.end();
