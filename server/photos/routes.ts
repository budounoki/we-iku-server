/**
 * 毎日の1枚カレンダー（写真カレンダー）API — originwebapp server/photos/routes.ts の移植。
 *
 * 第1段階（Web 版）の範囲: 写真の追加・一覧・日ごとの表示・カバー/メモ/はじめて・削除・画像配信。
 * 通知系のエンドポイント（Web Push 購読・設定・開封記録）は第2段階でアプリのネイティブ
 * プッシュ通知と一緒に入れるため、ここには含めない。
 */
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getActor } from "../supporter";
import { PhotoError, photoAccess, photoChildren, visibleAt } from "./access";
import { dateSchema, jstDate } from "./policy";
import { LocalPhotoStore, sanitizedImages, type PhotoStore } from "./storage";

/**
 * 書き込み系は同一オリジンからのリクエストのみ受け付ける（Cookie セッションの CSRF 対策）。
 * Bearer トークン（アプリ）はブラウザが自動送信しないため CSRF の対象外で、許可する。
 */
function isSameOriginRequest(req: Request) {
  if (req.headers.authorization?.startsWith("Bearer ")) return true;
  const origin = req.get("origin") || req.get("referer");
  if (!origin) return false;
  try { return new URL(origin).host === req.get("host"); } catch { return false; }
}

/** 写真テーブルが本番 DB に適用済みか（一度確認できたら以降は確認しない）。 */
let photoTablesReady = false;

const idSchema = z.coerce.number().int().positive();
const photoInput = z.object({
  requestId: z.string().uuid(), photoDate: dateSchema,
  source: z.enum(["camera", "library"]), takenAt: z.string().datetime({ offset: true }).nullable(),
  fullBase64: z.string().max(14_000_000), thumbBase64: z.string().max(2_000_000),
}).strict();
const patch = z.object({
  coverPhotoId: z.string().uuid().optional(), memo: z.string().max(2000).optional(),
  isFirst: z.boolean().optional(), firstLabel: z.string().max(120).optional(),
}).strict();
const storedDate = (value: string | Date) => typeof value === "string" ? value :
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const imageDto = (p: any) => ({
  id: p.id, photoDate: storedDate(p.photo_date), takenAt: p.taken_at, source: p.source,
  imageUrl: `/api/photos/${p.id}/image?size=full`, thumbUrl: `/api/photos/${p.id}/image?size=thumb`,
});
export function registerPhotoRoutes(app: Express, pool: Pool, store: PhotoStore = new LocalPhotoStore()) {
  const route = (method: "get" | "post" | "patch" | "delete" | "put", path: string,
    fn: (req: Request, db: PoolClient, uid: number, res: Response) => Promise<unknown>) => {
    app[method](path, async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      let db: PoolClient | undefined;
      try {
        const actor = await getActor(req);
        if (!actor) throw new PhotoError(401, "写真カレンダーを利用するにはログインしてください。");
        if (method !== "get" && !isSameOriginRequest(req)) throw new PhotoError(403, "この操作は許可されていません。");
        db = await pool.connect();
        // 本番 DB にテーブルが未適用のうちは「準備中」を返す（承認後に手動で適用する運用）。
        // これによりカレンダー画面の「写真」タブも、適用までは表示されない。
        if (!photoTablesReady) {
          const ready = await db.query("SELECT to_regclass('public.baby_photos') IS NOT NULL AND to_regclass('public.baby_days') IS NOT NULL AS ok");
          if (!ready.rows[0]?.ok) throw new PhotoError(503, "写真カレンダーは準備中です。");
          photoTablesReady = true;
        }
        await db.query("BEGIN");
        const result = await fn(req, db, actor.id, res);
        await db.query("COMMIT");
        if (!res.headersSent) res.json(result);
      } catch (error: any) {
        if (db) await db.query("ROLLBACK").catch(() => {});
        if (!res.headersSent) res.status(error instanceof PhotoError ? error.status : error instanceof z.ZodError ? 400 : 503)
          .json({ message: error instanceof PhotoError ? error.message : error instanceof z.ZodError ?
            "入力内容を確認してください。" : "写真サービスを利用できません。少し待って再試行してください。" });
      } finally { db?.release(); }
    });
  };
  const childDate = async (req: Request, db: PoolClient, uid: number, edit = false) => {
    const id = idSchema.parse(req.params.babyId);
    const access = await photoAccess(db, uid, id, edit);
    const date = dateSchema.parse(req.params.date ?? req.body.photoDate);
    if (date > jstDate() || (access[0].birthday && date < access[0].birthday)) {
      throw new PhotoError(400, "誕生日から今日までの日付を選んでください。");
    }
    return { id, access, date };
  };
  const ensureDay = async (db: PoolClient, baby: number, family: string, date: string) => {
    await db.query(`INSERT INTO baby_days(baby_id,family_id,date) VALUES($1,$2,$3)
      ON CONFLICT(baby_id,date) DO NOTHING`, [baby, family, date]);
    const { rows } = await db.query("SELECT * FROM baby_days WHERE baby_id=$1 AND date=$2 FOR UPDATE", [baby, date]);
    return rows[0];
  };
  route("get", "/api/photo-calendar/context", async (_req, db, uid) => {
    const children = await photoChildren(db, uid);
    return { children: Array.from(new Map(children.map(c => [c.id, { id: c.id, name: c.name, birthday: c.birthday, canEdit: c.can_edit }])).values()),
      canNotify: children.some(c => c.can_edit) };
  });
  route("get", "/api/photo-calendar/:babyId", async (req, db, uid) => {
    const id = idSchema.parse(req.params.babyId), access = await photoAccess(db, uid, id);
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);
    dateSchema.parse(`${month}-01`);
    const { rows } = await db.query(`SELECT d.*,p.created_at AS cover_created_at,p.deleted_at
      FROM baby_days d LEFT JOIN baby_photos p ON p.id=d.cover_photo_id
      WHERE d.baby_id=$1 AND d.date >= $2::date AND d.date < $2::date+interval '1 month' ORDER BY d.date`, [id, `${month}-01`]);
    return { canEdit: access.some(a => a.can_edit), days: rows.map(d => {
      const cover = !d.deleted_at && visibleAt(access, d.cover_created_at) ? d.cover_photo_id : null;
      return { date: storedDate(d.date), coverPhotoId: cover, thumbUrl: cover ? `/api/photos/${cover}/image?size=thumb` : null,
        isFirst: visibleAt(access, d.metadata_updated_at) && d.is_first };
    }).filter(d => access.some(a => a.can_edit) || d.coverPhotoId || d.isFirst) };
  });
  route("get", "/api/photo-calendar/:babyId/day/:date", async (req, db, uid) => {
    const { id, access, date } = await childDate(req, db, uid);
    const { rows } = await db.query("SELECT * FROM baby_photos WHERE baby_id=$1 AND photo_date=$2 AND deleted_at IS NULL ORDER BY created_at,id", [id, date]);
    const photos = rows.filter(p => visibleAt(access, p.created_at));
    const d = (await db.query("SELECT * FROM baby_days WHERE baby_id=$1 AND date=$2", [id, date])).rows[0];
    const meta = d && visibleAt(access, d.metadata_updated_at);
    return { date, photos: photos.map(imageDto), coverPhotoId: photos.some(p => p.id === d?.cover_photo_id) ? d.cover_photo_id : null,
      memo: meta ? d.memo : "", isFirst: meta ? d.is_first : false, firstLabel: meta ? d.first_label : "", canEdit: access.some(a => a.can_edit) };
  });
  route("post", "/api/photo-calendar/:babyId/photos", async (req, db, uid) => {
    const data = photoInput.parse(req.body);
    const { id, access, date } = await childDate(req, db, uid);
    // Lock per uploader for retry idempotency across different children.
    await db.query("SELECT pg_advisory_xact_lock(183737,$1)", [uid]);
    const previous = (await db.query("SELECT * FROM baby_photos WHERE uploaded_by=$1 AND request_id=$2", [uid, data.requestId])).rows[0];
    if (previous) {
      if (previous.baby_id !== id || storedDate(previous.photo_date) !== date || previous.deleted_at) throw new PhotoError(409, "同じ送信の内容が変更されています。");
      return { id: previous.id, photoDate: storedDate(previous.photo_date) };
    }
    const recent = await db.query("SELECT count(*)::int AS n FROM baby_photos WHERE uploaded_by=$1 AND created_at>now()-interval '1 minute'", [uid]);
    if (recent.rows[0].n >= 20) throw new PhotoError(429, "少し時間をおいてから追加してください。");
    let bytes;
    try { bytes = await sanitizedImages(data.fullBase64, data.thumbBase64); }
    catch { throw new PhotoError(400, "10MB以内のJPEG画像を選んでください。"); }
    const photoId = randomUUID();
    const key = `photos/${encodeURIComponent(access[0].family_id)}/${id}/${date}/${photoId}.jpg`;
    const thumbKey = key.replace(".jpg", "_thumb.jpg");
    const day = await ensureDay(db, id, access[0].family_id, date);
    try {
      await store.put(key, bytes.full);
      await store.put(thumbKey, bytes.thumb);
      await db.query(`INSERT INTO baby_photos(id,baby_id,family_id,uploaded_by,request_id,photo_date,taken_at,source,storage_key,thumb_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [photoId, id, access[0].family_id, uid, data.requestId, date, data.takenAt, data.source, key, thumbKey]);
      if (!day.cover_photo_id) await db.query("UPDATE baby_days SET cover_photo_id=$1,updated_at=now() WHERE id=$2", [photoId, day.id]);
    } catch (error) {
      await Promise.allSettled([store.delete(key), store.delete(thumbKey)]);
      throw error;
    }
    return { id: photoId, photoDate: date };
  });
  route("patch", "/api/photo-calendar/:babyId/day/:date", async (req, db, uid) => {
    const { id, access, date } = await childDate(req, db, uid, true);
    const data = patch.parse(req.body), day = await ensureDay(db, id, access[0].family_id, date);
    if (data.coverPhotoId) {
      const photo = (await db.query("SELECT id FROM baby_photos WHERE id=$1 AND baby_id=$2 AND photo_date=$3 AND deleted_at IS NULL", [data.coverPhotoId, id, date])).rows[0];
      if (!photo) throw new PhotoError(400, "この日の写真を選んでください。");
    }
    await db.query(`UPDATE baby_days SET cover_photo_id=$2,memo=$3,is_first=$4,first_label=$5,
      metadata_updated_at=CASE WHEN $6 THEN now() ELSE metadata_updated_at END,updated_at=now() WHERE id=$1`,
    [day.id, data.coverPhotoId ?? day.cover_photo_id, data.memo ?? day.memo, data.isFirst ?? day.is_first,
      data.firstLabel ?? day.first_label, data.memo !== undefined || data.isFirst !== undefined || data.firstLabel !== undefined]);
    return { ok: true };
  });
  route("delete", "/api/photos/:id", async (req, db, uid) => {
    const photoId = z.string().uuid().parse(req.params.id);
    const p = (await db.query("SELECT * FROM baby_photos WHERE id=$1", [photoId])).rows[0];
    if (!p) throw new PhotoError(404, "写真が見つかりません。");
    await photoAccess(db, uid, p.baby_id, true);
    const day = await ensureDay(db, p.baby_id, p.family_id, p.photo_date);
    await db.query("UPDATE baby_photos SET deleted_at=coalesce(deleted_at,now()) WHERE id=$1", [photoId]);
    if (day.cover_photo_id === photoId) {
      const next = (await db.query("SELECT id FROM baby_photos WHERE baby_id=$1 AND photo_date=$2 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1", [p.baby_id, p.photo_date])).rows[0];
      await db.query("UPDATE baby_days SET cover_photo_id=$2,updated_at=now() WHERE id=$1", [day.id, next?.id ?? null]);
    }
    return { ok: true };
  });
  route("get", "/api/photos/:id/image", async (req, db, uid, res) => {
    const photoId = z.string().uuid().parse(req.params.id);
    const size = z.enum(["thumb", "full"]).parse(req.query.size ?? "full");
    const p = (await db.query("SELECT * FROM baby_photos WHERE id=$1 AND deleted_at IS NULL", [photoId])).rows[0];
    if (!p) throw new PhotoError(404, "写真が見つかりません。");
    const access = await photoAccess(db, uid, p.baby_id);
    if (!visibleAt(access, p.created_at)) throw new PhotoError(403, "この写真は閲覧できません。");
    const bytes = await store.get(size === "thumb" ? p.thumb_key : p.storage_key);
    res.type("jpeg").send(bytes);
  });
}
