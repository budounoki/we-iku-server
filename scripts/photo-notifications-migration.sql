-- 写真のおしらせ（ランダム時刻・1日1回・音なし）: 追加のみのマイグレーション。
-- 既存テーブルは変更・削除しない。適用前に必ずバックアップを取り、クライアントの承認を得ること。
--   pg_dump -Fc "$DATABASE_URL" > /home/ubuntu/db_backups/weiku_pre_photo_notify_$(date +%Y%m%d%H%M).dump
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/photo-notifications-migration.sql
-- 適用しただけでは送信は始まらない。送信は .env の PHOTO_REMINDERS_ENABLED=true で開始する。
-- 切り戻し: PHOTO_REMINDERS_ENABLED を外して pm2 restart（表は残してよい。履歴保持のため削除しない）。
BEGIN;
CREATE TABLE IF NOT EXISTS photo_notification_settings (
  user_id integer PRIMARY KEY CONSTRAINT photo_notification_settings_user_id_users_id_fk REFERENCES users(id),
  enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS photo_notification_jobs (
  id            uuid PRIMARY KEY,
  user_id       integer NOT NULL CONSTRAINT photo_notification_jobs_user_id_users_id_fk REFERENCES users(id),
  date          date NOT NULL,
  scheduled_at  timestamptz NOT NULL,
  next_check_at timestamptz NOT NULL,
  state         text NOT NULL DEFAULT 'pending'
                CONSTRAINT photo_notification_jobs_state_check CHECK (state IN ('pending','sending','sent','uncertain')),
  baby_id       integer CONSTRAINT photo_notification_jobs_baby_id_children_id_fk REFERENCES children(id),
  trigger_type  text,
  attempted_at  timestamptz,
  sent_at       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS photo_notification_jobs_daily_unique ON photo_notification_jobs (user_id, date);
CREATE TABLE IF NOT EXISTS photo_notification_logs (
  id           uuid PRIMARY KEY,
  user_id      integer NOT NULL CONSTRAINT photo_notification_logs_user_id_users_id_fk REFERENCES users(id),
  baby_id      integer NOT NULL CONSTRAINT photo_notification_logs_baby_id_children_id_fk REFERENCES children(id),
  sent_at      timestamptz NOT NULL,
  trigger_type text NOT NULL,
  opened_at    timestamptz,
  photo_taken  boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS photo_notification_logs_user_sent ON photo_notification_logs (user_id, sent_at);
CREATE TABLE IF NOT EXISTS photo_activity (
  user_id        integer PRIMARY KEY CONSTRAINT photo_activity_user_id_users_id_fk REFERENCES users(id),
  settling_until timestamptz
);
COMMIT;
