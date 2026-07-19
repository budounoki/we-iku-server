import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

console.log('=== community_memberships columns ===');
let r = await pool.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='community_memberships'
  ORDER BY ordinal_position
`);
r.rows.forEach(x => console.log(`  ${x.column_name} : ${x.data_type} (nullable=${x.is_nullable}, default=${x.column_default})`));

console.log('\n=== community_memberships constraints ===');
r = await pool.query(`
  SELECT conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'community_memberships'
`);
r.rows.forEach(x => console.log(`  ${x.conname}: ${x.def}`));

console.log('\n=== community_memberships indexes ===');
r = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'community_memberships'`);
r.rows.forEach(x => console.log(`  ${x.indexname}: ${x.indexdef}`));

console.log('\n=== community_rooms columns (checking currentMembers/maxMembers) ===');
r = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='community_rooms'
  ORDER BY ordinal_position
`);
r.rows.forEach(x => console.log(`  ${x.column_name} : ${x.data_type}`));

console.log('\n=== try direct INSERT (roomId=10, profileId=999999) ===');
try {
  await pool.query(`INSERT INTO community_memberships (room_id, profile_id) VALUES (10, 999999)`);
  console.log('  INSERT succeeded');
  await pool.query(`DELETE FROM community_memberships WHERE room_id=10 AND profile_id=999999`);
  console.log('  cleanup ok');
} catch (e) {
  console.log('  FAILED:', e.message);
  console.log('  code:', e.code, 'detail:', e.detail);
}

console.log('\n=== try direct INSERT with existing profile 8 into room 10 ===');
try {
  await pool.query(`INSERT INTO community_memberships (room_id, profile_id) VALUES (10, 8)`);
  console.log('  INSERT succeeded');
} catch (e) {
  console.log('  FAILED:', e.message);
  console.log('  code:', e.code, 'detail:', e.detail);
}

console.log('\n=== try the same UPDATE the join route does ===');
try {
  await pool.query(`UPDATE community_rooms SET current_members = current_members + 1 WHERE id = 10 RETURNING current_members`);
  console.log('  UPDATE succeeded');
  await pool.query(`UPDATE community_rooms SET current_members = current_members - 1 WHERE id = 10`);
} catch (e) {
  console.log('  FAILED:', e.message);
}

await pool.end();
