// Snapshot ALL data from current Neon DB to a JSON file for rollback safety
import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const tablesRes = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);

const snapshot = { takenAt: new Date().toISOString(), tables: {} };
for (const { table_name } of tablesRes.rows) {
  const r = await pool.query(`SELECT * FROM "${table_name}"`);
  snapshot.tables[table_name] = r.rows;
  console.log(`  ${table_name}: ${r.rows.length} rows`);
}

const outPath = `/tmp/weiku_snapshot_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`\nSnapshot saved: ${outPath} (${sizeMB} MB)`);
await pool.end();
