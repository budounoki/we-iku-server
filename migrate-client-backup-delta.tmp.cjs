/**
 * Delta migration: merge only the NEW rows from the client's 2026-09-08
 * dump (weiku_client_staging2) that weren't already migrated from the
 * 2026-08-23 dump. Same +1,000,000 id offset scheme as the first migration,
 * so "already migrated" = staging row's id, once offset, already exists
 * in production.
 */
const { Client } = require('pg');

const OFFSET = 1000000;
const PASS = process.env.DB_PASS;
const src = new Client({ host: 'localhost', user: 'weiku', password: PASS, database: 'weiku_client_staging2' });
const dst = new Client({ host: 'localhost', user: 'weiku', password: PASS, database: 'weiku' });

const SKIP_SETTINGS_FAMILY_IDS = ['default', 'test-family-id', 'family-mlz8qgez'];

async function copyTableDelta(table, columns, opts = {}) {
  const { idCol = 'id', fkCols = [], transform = null } = opts;
  const rows = (await src.query(`SELECT * FROM ${table}`)).rows;

  const existingIds = new Set(
    (await dst.query(`SELECT ${idCol} FROM ${table} WHERE ${idCol} > ${OFFSET}`)).rows
      .map((r) => r[idCol] - OFFSET),
  );

  let inserted = 0, skippedExisting = 0, skippedOther = 0;
  for (const row of rows) {
    if (existingIds.has(row[idCol])) { skippedExisting++; continue; }
    if (transform) {
      const keep = transform(row);
      if (keep === false) { skippedOther++; continue; }
    }
    row[idCol] = row[idCol] + OFFSET;
    for (const fk of fkCols) {
      if (row[fk] !== null && row[fk] !== undefined) row[fk] = row[fk] + OFFSET;
    }
    const vals = columns.map((c) => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    await dst.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, vals);
    inserted++;
  }
  console.log(`${table}: inserted ${inserted} new, skipped ${skippedExisting} already-migrated, skipped ${skippedOther} other`);
}

async function bumpSequence(table, idCol = 'id') {
  await dst.query(
    `SELECT setval(pg_get_serial_sequence('${table}', '${idCol}'), (SELECT GREATEST(COALESCE(MAX(${idCol}),1), 1) FROM ${table}))`,
  );
}

async function main() {
  await src.connect();
  await dst.connect();
  await dst.query('BEGIN');
  try {
    const validChildIds = new Set((await src.query('SELECT id FROM children')).rows.map((r) => r.id));

    await copyTableDelta('users', [
      'id', 'line_user_id', 'display_name', 'picture_url', 'family_id', 'role',
      'created_at', 'invitation_verified',
    ]);
    await copyTableDelta('children', [
      'id', 'family_id', 'name', 'birthday', 'color', 'created_at', 'gender',
      'blood_type', 'sleep_training_enabled', 'rotavirus_vaccine_type',
    ]);
    await copyTableDelta('coupons', ['id', 'family_id', 'title', 'cost', 'is_custom', 'created_by', 'created_at']);
    await copyTableDelta('sleep_routines', ['id', 'family_id', 'title', 'assignee', 'sort_order', 'created_at']);
    await copyTableDelta('invitation_codes', ['id', 'code', 'is_used', 'used_by', 'used_at', 'created_at']);
    await copyTableDelta('events', [
      'id', 'family_id', 'title', 'date', 'time', 'assignee', 'completed',
      'completed_by', 'points', 'memo', 'created_at', 'icon', 'color',
    ]);
    await copyTableDelta('feedbacks', ['id', 'family_id', 'user_id', 'message', 'created_at']);
    await copyTableDelta('food_ingredients', [
      'id', 'family_id', 'child_id', 'ingredient_name', 'category', 'status',
      'first_tried_date', 'notes', 'is_custom', 'created_at', 'updated_at',
    ], { fkCols: ['child_id'] });
    await copyTableDelta('growth_records', [
      'id', 'family_id', 'user_id', 'weight_grams', 'height_cm',
      'head_circumference_cm', 'measured_at', 'created_at', 'child_id',
    ], { fkCols: ['child_id'] });
    await copyTableDelta('health_records', [
      'id', 'family_id', 'child_id', 'type', 'title', 'detail', 'recorded_at', 'created_at',
    ], { fkCols: ['child_id'] });
    await copyTableDelta('custom_vaccines', ['id', 'family_id', 'child_id', 'name', 'created_at'], { fkCols: ['child_id'] });
    await copyTableDelta('vaccination_records', [
      'id', 'family_id', 'child_id', 'vaccine_id', 'administered_date', 'note', 'created_at',
    ], { fkCols: ['child_id'] });
    await copyTableDelta('custom_childcare_items', [
      'id', 'family_id', 'item_name', 'icon', 'created_by', 'is_active', 'created_at',
    ]);
    await copyTableDelta('custom_quick_actions', [
      'id', 'family_id', 'label', 'icon_name', 'color_scheme', 'sort_order', 'is_active', 'created_at',
    ]);
    await copyTableDelta('logs', [
      'id', 'type', 'message', 'created_at', 'family_id', 'user_id', 'points',
      'sub_type', 'food_items', 'food_amount', 'is_new_food', 'image_url',
      'poop_color', 'poop_consistency', 'body_temperature', 'symptoms',
      'symptom_note', 'breast_left_min', 'breast_right_min', 'is_expressed',
      'expressed_ml', 'formula_ml', 'child_id', 'stool_type', 'stool_amount',
      'stool_color', 'medicine_name', 'medicine_dose', 'performed_by',
      'spit_up', 'spit_up_amount', 'spit_up_timing', 'spit_up_note',
      'settling_method', 'settling_minutes', 'sleep_location', 'food_note',
      'hold_end_at', 'sleep_note', 'walk_end_at', 'exclude_from_interval',
    ], {
      fkCols: ['child_id'],
      transform: (row) => row.child_id === null || validChildIds.has(row.child_id),
    });
    await copyTableDelta('mama_health_logs', [
      'id', 'user_id', 'logged_at', 'bowel', 'bowel_note', 'lochia',
      'perineal_pain', 'mood', 'sleep_hours', 'nursing_issues', 'nursing_note',
      'weight_kg', 'swelling',
    ], { fkCols: ['user_id'] });
    await copyTableDelta('notifications', [
      'id', 'family_id', 'target_user', 'message', 'type', 'read', 'created_at', 'child_id', 'dedupe_key',
    ], { fkCols: ['child_id'] });
    await copyTableDelta('settings', [
      'id', 'baby_name', 'current_caregiver', 'family_id', 'baby_birthday', 'special_trick',
    ], { transform: (row) => !SKIP_SETTINGS_FAMILY_IDS.includes(row.family_id) });
    await copyTableDelta('skill_completions', ['id', 'family_id', 'user_id', 'skill_id', 'completed_at']);
    await copyTableDelta('sleep_checklist', [
      'id', 'family_id', 'date', 'darkness', 'temperature', 'safety', 'white_noise', 'created_at',
    ]);
    await copyTableDelta('sleep_routine_logs', ['id', 'family_id', 'routine_id', 'date', 'completed_by', 'completed_at'], { fkCols: ['routine_id'] });
    await copyTableDelta('sleep_sessions', [
      'id', 'family_id', 'started_at', 'ended_at', 'duration_min', 'created_by', 'created_at', 'child_id', 'performed_by',
    ], { fkCols: ['child_id'] });
    await copyTableDelta('user_coupons', [
      'id', 'family_id', 'coupon_id', 'coupon_title', 'cost', 'owner_id', 'status', 'used_at', 'created_at',
    ], { fkCols: ['coupon_id'] });
    await copyTableDelta('we_board', ['id', 'family_id', 'user_id', 'message', 'created_at']);
    await copyTableDelta('diary_entries', [
      'id', 'family_id', 'child_id', 'user_id', 'date', 'title', 'content',
      'mood', 'weather', 'tags', 'images', 'visibility', 'created_at', 'updated_at',
    ], { fkCols: ['child_id'] });

    for (const t of [
      'users', 'children', 'coupons', 'sleep_routines', 'invitation_codes',
      'events', 'feedbacks', 'food_ingredients', 'growth_records',
      'health_records', 'custom_vaccines', 'vaccination_records',
      'custom_childcare_items', 'custom_quick_actions', 'logs',
      'mama_health_logs', 'notifications', 'settings', 'skill_completions',
      'sleep_checklist', 'sleep_routine_logs', 'sleep_sessions',
      'user_coupons', 'we_board', 'diary_entries',
    ]) {
      await bumpSequence(t);
    }

    // New family(ies) that just showed up need a family_plans row too,
    // matching the free_forever backfill for pre-existing monitor accounts.
    await dst.query(`
      INSERT INTO family_plans (family_id, price_tier)
      SELECT DISTINCT family_id, 'free_forever' FROM users
      ON CONFLICT (family_id) DO NOTHING
    `);

    await dst.query('COMMIT');
    console.log('COMMITTED');
  } catch (err) {
    await dst.query('ROLLBACK');
    console.error('ROLLED BACK:', err);
    process.exitCode = 1;
  } finally {
    await src.end();
    await dst.end();
  }
}

main();
