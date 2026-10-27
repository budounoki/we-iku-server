/**
 * 写真の保存先。
 *
 * originwebapp は Replit App Storage を使っていたが、we-iku.app は DB と同じこの
 * サーバー上で動いているため、写真もこのサーバーのディスクに置く（DB と同じ耐久性）。
 * 設計書の方針は維持する:
 *   - Web 公開ディレクトリの外（既定 /home/ubuntu/we-iku-photos）に置き、公開 URL を作らない
 *   - 画像は権限確認つきの API（/api/photos/:id/image）経由でのみ返す
 *   - キーはサーバーが組み立てたものだけを受け付け、保存先の外を指すパスは拒否する
 * バックアップ: DB と同じく、このディレクトリもバックアップ対象に含めること。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export interface PhotoStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalPhotoStore implements PhotoStore {
  private readonly root = path.resolve(process.env.PHOTO_STORAGE_DIR || "/home/ubuntu/we-iku-photos");

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep) || !/\.jpg$/.test(full)) throw new Error("INVALID_PHOTO_KEY");
    return full;
  }
  async put(key: string, bytes: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    // 一時ファイルに書いてから rename（途中で落ちても壊れたファイルを残さない）。
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, bytes, { mode: 0o600 });
    await fs.rename(tmp, file);
  }
  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/** クライアントの画像を信用せず、サーバー側で JPEG として作り直す（EXIF・GPS も消える）。 */
export async function sanitizedImages(fullBase64: string, thumbBase64: string) {
  const decode = (s: string) => {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) throw new Error("INVALID_IMAGE");
    const b = Buffer.from(s, "base64");
    if (!b.length || b.length > 10 * 1024 * 1024) throw new Error("INVALID_IMAGE_SIZE");
    return b;
  };
  const full = decode(fullBase64), thumb = decode(thumbBase64);
  if (full.length + thumb.length > 10 * 1024 * 1024) throw new Error("INVALID_IMAGE_SIZE");
  for (const bytes of [full, thumb]) {
    const m = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    if (m.format !== "jpeg" || !m.width || !m.height) throw new Error("INVALID_IMAGE");
  }
  return {
    full: await sharp(full, { limitInputPixels: 40_000_000 }).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    thumb: await sharp(full, { limitInputPixels: 40_000_000 }).rotate().resize(400, 400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
  };
}
