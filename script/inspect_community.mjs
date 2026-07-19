import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const tables = ['community_profiles', 'community_rooms', 'community_memberships', 'community_posts', 'community_reactions', 'community_reports', 'community_blocks'];
for (const t of tables) {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
    console.log(`${t}: ${r.rows[0].c}`);
  } catch (e) {
    console.log(`${t}: ERR ${e.message.split('\n')[0]}`);
  }
}

console.log('\n=== rooms sample ===');
try {
  const r = await pool.query(`SELECT id, type, slug, name, current_members, max_members, is_active FROM community_rooms ORDER BY id LIMIT 20`);
  r.rows.forEach(x => console.log(x));
} catch (e) { console.log(e.message); }

console.log('\n=== profiles sample ===');
try {
  const r = await pool.query(`SELECT id, user_id, nickname, avatar_icon FROM community_profiles ORDER BY id LIMIT 10`);
  r.rows.forEach(x => console.log(x));
} catch (e) { console.log(e.message); }

await pool.end();
