import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('/home/ubuntu/Downloads/WeApp/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);

const { Pool } = pg;
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Idempotent: only rename if joined_at exists and created_at does not
  const check = await client.query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_memberships' AND column_name='joined_at')  AS has_joined_at,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='community_memberships' AND column_name='created_at') AS has_created_at
  `);
  const { has_joined_at, has_created_at } = check.rows[0];
  console.log(`before → has joined_at: ${has_joined_at}, has created_at: ${has_created_at}`);

  if (has_joined_at && !has_created_at) {
    await client.query(`ALTER TABLE community_memberships RENAME COLUMN joined_at TO created_at`);
    console.log('renamed joined_at → created_at');
  } else if (has_created_at) {
    console.log('created_at already exists — no rename needed');
  } else {
    throw new Error('unexpected column state');
  }

  await client.query('COMMIT');

  const after = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='community_memberships'
    ORDER BY ordinal_position
  `);
  console.log('after columns:', after.rows.map(r => r.column_name).join(', '));
} catch (e) {
  await client.query('ROLLBACK');
  console.error('FAILED, rolled back:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
