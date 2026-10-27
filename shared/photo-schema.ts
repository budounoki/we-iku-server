/**
 * 毎日の1枚カレンダー（写真カレンダー）— Web 版 第1段階のテーブル。
 *
 * クライアントの originwebapp（shared/photo-schema.ts, 2026-10-26）からの移植。
 * 第1段階は写真と日ごとのメタデータのみ。通知（Web Push・スケジューラ・学習）の
 * テーブルは、アプリ版でネイティブのプッシュ通知を使う第2段階で追加する。
 *
 * 移植時の変更: family_id の settings(family_id) への外部キーは付けない。
 * WeApp ではすべての家族に settings 行がある保証がなく、無い家族で写真の保存が
 * 失敗するため。家族の正は children.family_id。
 *
 * 本番 DB へは自動で作成しない。scripts/photo-calendar-migration.sql を、
 * バックアップ取得とクライアントの承認後に手動で適用する（設計書の運用方針）。
 */
import { pgTable, serial, integer, text, date, timestamp, boolean, uuid, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, children } from "./schema";

export const babyPhotos = pgTable("baby_photos", {
  id: uuid("id").primaryKey(),
  babyId: integer("baby_id").notNull().references(() => children.id),
  familyId: text("family_id").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  requestId: uuid("request_id").notNull(),
  photoDate: date("photo_date").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  source: text("source").notNull(),
  storageKey: text("storage_key").notNull(),
  thumbKey: text("thumb_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, t => [
  uniqueIndex("baby_photos_request_unique").on(t.uploadedBy, t.requestId),
  // 日ごとの写真一覧・カレンダー表示用。
  index("baby_photos_baby_date").on(t.babyId, t.photoDate).where(sql`${t.deletedAt} IS NULL`),
  check("baby_photos_source_check", sql`${t.source} IN ('camera','library')`),
]);

export const babyDays = pgTable("baby_days", {
  id: serial("id").primaryKey(),
  babyId: integer("baby_id").notNull().references(() => children.id),
  familyId: text("family_id").notNull(),
  date: date("date").notNull(),
  coverPhotoId: uuid("cover_photo_id").references(() => babyPhotos.id),
  memo: text("memo").notNull().default(""),
  isFirst: boolean("is_first").notNull().default(false),
  firstLabel: text("first_label").notNull().default(""),
  metadataUpdatedAt: timestamp("metadata_updated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("baby_days_baby_date_unique").on(t.babyId, t.date)]);
