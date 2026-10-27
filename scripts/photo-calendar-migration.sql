-- 毎日の1枚カレンダー（Web 版 第1段階）: 追加のみのマイグレーション。
-- 既存テーブルは変更・削除しない。適用前に必ずバックアップを取り、クライアントの承認を得ること。
--   pg_dump -Fc "$DATABASE_URL" > /home/ubuntu/db-backups/weiku_pre_photo_$(date +%Y%m%d%H%M).dump
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/photo-calendar-migration.sql
BEGIN;
CREATE TABLE IF NOT EXISTS baby_photos (
  id           uuid PRIMARY KEY,
  baby_id      integer NOT NULL CONSTRAINT baby_photos_baby_id_children_id_fk REFERENCES children(id),
  family_id    text NOT NULL,
  uploaded_by  integer NOT NULL CONSTRAINT baby_photos_uploaded_by_users_id_fk REFERENCES users(id),
  request_id   uuid NOT NULL,
  photo_date   date NOT NULL,
  taken_at     timestamptz,
  source       text NOT NULL CONSTRAINT baby_photos_source_check CHECK (source IN ('camera','library')),
  storage_key  text NOT NULL,
  thumb_key    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS baby_photos_request_unique ON baby_photos (uploaded_by, request_id);
CREATE INDEX IF NOT EXISTS baby_photos_baby_date ON baby_photos (baby_id, photo_date) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS baby_days (
  id                   serial PRIMARY KEY,
  baby_id              integer NOT NULL CONSTRAINT baby_days_baby_id_children_id_fk REFERENCES children(id),
  family_id            text NOT NULL,
  date                 date NOT NULL,
  cover_photo_id       uuid CONSTRAINT baby_days_cover_photo_id_baby_photos_id_fk REFERENCES baby_photos(id),
  memo                 text NOT NULL DEFAULT '',
  is_first             boolean NOT NULL DEFAULT false,
  first_label          text NOT NULL DEFAULT '',
  metadata_updated_at  timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS baby_days_baby_date_unique ON baby_days (baby_id, date);
COMMIT;
