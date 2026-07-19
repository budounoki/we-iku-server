import fs from 'fs';
import pg from 'pg';
const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query(`
  SELECT
    (SELECT last_value FROM community_memberships_id_seq)  AS seq_last,
    (SELECT is_called FROM community_memberships_id_seq)   AS seq_called,
    (SELECT COALESCE(MAX(id),0) FROM community_memberships) AS max_id,
    (SELECT COUNT(*) FROM community_memberships)            AS row_count
`);
console.log(r.rows[0]);
await pool.end();
