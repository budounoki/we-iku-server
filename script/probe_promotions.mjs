import fs from 'fs';
import pg from 'pg';
const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Drizzle expected columns:
const expected = {
  sponsors: ['id','name','logo_url','website_url','description','is_active','created_at'],
  promotions: ['id','sponsor_id','trigger_log_type','trigger_time_start','trigger_time_end','is_active','impression_count','click_count','title','description','image_url','cta_url','cta_label','display_type','target_log_types','weight','priority','created_at'],
  sponsored_coupons: ['id','sponsor_id','title','description','image_url','points_cost','remaining_stock','quantity','discount_value','discount_type','exchanged_at','valid_until','is_active','created_at'],
  promotion_impressions: ['id','promotion_id','family_id','user_id','created_at'],
};

for (const [table, expCols] of Object.entries(expected)) {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]);
  const actual = r.rows.map(x => x.column_name);
  if (actual.length === 0) { console.log(`⚠️  ${table}: TABLE DOES NOT EXIST`); continue; }
  const missing = expCols.filter(c => !actual.includes(c));
  const extra = actual.filter(c => !expCols.includes(c));
  const flag = (missing.length || extra.length) ? '⚠️ ' : '✓ ';
  console.log(`${flag}${table}`);
  if (missing.length) console.log(`   MISSING (schema expects, DB lacks): ${missing.join(', ')}`);
  if (extra.length)   console.log(`   EXTRA (DB has, schema does not): ${extra.join(', ')}`);
}

// Try the exact queries the routes do
console.log('\n=== SELECT emulating /api/sponsored-coupons ===');
try {
  await pool.query(`SELECT id, sponsor_id, title, description, image_url, points_cost, remaining_stock, quantity, discount_value, discount_type, exchanged_at, valid_until, is_active, created_at FROM sponsored_coupons WHERE is_active = true`);
  console.log('OK');
} catch (e) { console.log('FAIL:', e.message); }

console.log('\n=== SELECT emulating /api/promotions/contextual (query for log_type=chore) ===');
try {
  await pool.query(`SELECT id, sponsor_id, trigger_log_type, trigger_time_start, trigger_time_end, is_active, impression_count, click_count, title, description, image_url, cta_url, cta_label, display_type, target_log_types, weight, priority, created_at FROM promotions WHERE is_active = true AND trigger_log_type = 'chore'`);
  console.log('OK');
} catch (e) { console.log('FAIL:', e.message); }

await pool.end();
