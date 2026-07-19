import fs from 'fs';
import pg from 'pg';
const env = Object.fromEntries(fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; }));
const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
for (const t of ['promotions','sponsored_coupons','promotion_impressions','mama_medicine_records']) {
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
  console.log(`${t}: ${r.rows[0].c}`);
}
console.log('\n--- promotions sample ---');
const p = await pool.query('SELECT * FROM promotions LIMIT 3');
p.rows.forEach(x => console.log(x));
console.log('\n--- sponsored_coupons sample ---');
const s = await pool.query('SELECT * FROM sponsored_coupons LIMIT 3');
s.rows.forEach(x => console.log(x));
await pool.end();
