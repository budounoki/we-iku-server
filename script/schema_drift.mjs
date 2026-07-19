import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// What the drizzle schema expects (from shared/schema.ts):
const expected = {
  community_profiles: ['id','user_id','nickname','avatar_icon','child_age_months','show_child_age','created_at'],
  community_rooms: ['id','type','slug','name','description','icon','trigger_log_types','age_months_min','age_months_max','max_members','current_members','is_active','created_at'],
  community_memberships: ['id','room_id','profile_id','created_at'],
  community_posts: ['id','room_id','profile_id','body','is_hidden','created_at'],
  community_reactions: ['id','post_id','profile_id','type','created_at'],
  community_reports: ['id','post_id','reporter_profile_id','target_profile_id','reason','status','created_at'],
  community_blocks: ['id','blocker_profile_id','blocked_profile_id','created_at'],
};

for (const [table, expCols] of Object.entries(expected)) {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]);
  const actual = r.rows.map(x => x.column_name);
  const missing = expCols.filter(c => !actual.includes(c));
  const extra = actual.filter(c => !expCols.includes(c));
  const flag = (missing.length || extra.length) ? '⚠️ ' : '✓ ';
  console.log(`${flag}${table}`);
  if (missing.length) console.log(`   MISSING (schema expects, DB lacks): ${missing.join(', ')}`);
  if (extra.length)   console.log(`   EXTRA (DB has, schema does not): ${extra.join(', ')}`);
}

// Also demonstrate the failure clearly:
console.log('\n=== simulate what drizzle does ===');
try {
  await pool.query(`SELECT id, room_id, profile_id, created_at FROM community_memberships LIMIT 1`);
  console.log('SELECT with created_at: OK');
} catch (e) {
  console.log('SELECT with created_at:', e.message);
}
try {
  await pool.query(`SELECT id, room_id, profile_id, joined_at FROM community_memberships LIMIT 1`);
  console.log('SELECT with joined_at: OK');
} catch (e) {
  console.log('SELECT with joined_at:', e.message);
}

await pool.end();
