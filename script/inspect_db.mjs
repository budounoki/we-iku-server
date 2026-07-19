// Quick inspection of current Neon DB
import fs from 'fs';
import pg from 'pg';
const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
process.env = { ...process.env, ...env };

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const tables = [
  'users', 'children', 'settings', 'logs', 'events', 'coupons', 'user_coupons',
  'feedbacks', 'notifications', 'growth_records', 'health_records',
  'diary_entries', 'mama_health_logs', 'food_ingredients',
  'invitation_codes', 'vaccination_records', 'custom_vaccines',
  'custom_childcare_items', 'custom_quick_actions',
  'sleep_sessions', 'sleep_routines', 'sleep_routine_logs', 'sleep_checklist',
  'skill_completions', 'we_board', 'session',
];

const out = {};
for (const t of tables) {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
    out[t] = r.rows[0].c;
  } catch (e) {
    out[t] = `ERR: ${e.message.split('\n')[0]}`;
  }
}
console.log(JSON.stringify(out, null, 2));

// Also show columns for `users` since the typecheck error mentioned pushToken
try {
  const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
  console.log('\nusers columns:');
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
} catch (e) { console.log('users cols err', e.message); }

await pool.end();
