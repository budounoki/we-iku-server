-- ============================================================================
-- Supporter feature activation — parent_access backfill (grandfather migration)
-- ============================================================================
-- WHAT: Populate parent_access with one verified row per existing parent, so
--       that when the supporter strict-mode flags are enabled, every existing
--       family keeps working. Without this, strict mode 403s ALL legacy /api/*
--       calls for families that have no parent_access row (this is exactly what
--       broke the old we-iku.com).
--
-- POLICY (REQUIRES CLIENT SIGN-OFF BEFORE RUNNING):
--   Treat every existing OAuth-authenticated papa/mama (Google/LINE/Apple) as
--   "verified" at the migration cutover. Rationale: these are real logged-in
--   accounts on ぶどうの木's own app, and verifying ~330 families by hand is not
--   feasible. The strict admin-verification (/api/admin/supporter/parents)
--   remains the path for any NEW parent_access rows added after cutover.
--
-- SCOPE (verified 2026-10): 333 users, all papa/mama, all with a family_id.
--   0 role='other', 0 missing family_id → no one is excluded, no lockout.
--
-- SAFETY:
--   * Additive only. Idempotent (ON CONFLICT DO NOTHING on the
--     (user_id, family_id) unique index). Re-running is harmless.
--   * Run this BEFORE flipping SUPPORTER_ACCESS_ENABLED / switching the server
--     to production mode. While the flags are OFF, these rows are inert
--     (verifiedParentFamilies() is only consulted in strict mode).
--   * Take a DB backup first.
--
-- RUN:  psql "$DATABASE_URL" -f scripts/supporter-parent-access-backfill.sql
-- ============================================================================

BEGIN;

-- Pre-flight: how many rows will be inserted (papa/mama with a family, not
-- already present). Review this number before committing.
SELECT count(*) AS rows_to_insert
FROM users u
WHERE u.role IN ('papa', 'mama')
  AND u.family_id IS NOT NULL
  AND u.family_id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM parent_access pa
    WHERE pa.user_id = u.id AND pa.family_id = u.family_id
  );

-- The backfill. verified_at = now() marks the cutover timestamp.
INSERT INTO parent_access (user_id, family_id, role, verified_at, created_at)
SELECT u.id, u.family_id, u.role, now(), now()
FROM users u
WHERE u.role IN ('papa', 'mama')
  AND u.family_id IS NOT NULL
  AND u.family_id <> ''
ON CONFLICT (user_id, family_id) DO NOTHING;

-- Post-check: total verified rows, distinct families and users covered.
SELECT
  count(*)                       AS parent_access_rows,
  count(DISTINCT family_id)      AS families_covered,
  count(DISTINCT user_id)        AS users_covered,
  count(*) FILTER (WHERE verified_at IS NULL) AS unverified_should_be_zero
FROM parent_access;

-- Sanity: any active family (has a child) with NO verified parent after backfill
-- would be locked out under strict mode. This must return 0 rows before cutover.
SELECT DISTINCT c.family_id AS family_with_no_verified_parent
FROM children c
WHERE NOT EXISTS (
  SELECT 1 FROM parent_access pa
  WHERE pa.family_id = c.family_id AND pa.verified_at IS NOT NULL
);

-- Review the three result sets above. If they look right, COMMIT; otherwise ROLLBACK.
COMMIT;
