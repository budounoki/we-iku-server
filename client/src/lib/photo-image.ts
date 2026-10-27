import * as exifr from "exifr";

export type PreparedPhoto = { fullBase64: string; thumbBase64: string; takenAt: string | null; preview: string };

/** Read only capture time before conversion; canvas output never retains GPS or EXIF. */
export async function preparePhoto(file: File, camera = false): Promise<PreparedPhoto> {
  let takenAt: string | null = camera ? new Date().toISOString() : null;
  if (!camera) {
    try {
      const metadata = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal"] });
      const captured = metadata?.DateTimeOriginal || metadata?.CreateDate;
      if (captured instanceof Date && !Number.isNaN(captured.getTime())) {
        // EXIF without offset is a wall clock, interpreted as Japanese local time.
        const pad = (n: number) => String(n).padStart(2, "0");
        const wall = `${captured.getFullYear()}-${pad(captured.getMonth() + 1)}-${pad(captured.getDate())}T${pad(captured.getHours())}:${pad(captured.getMinutes())}:${pad(captured.getSeconds())}`;
        const offset = typeof metadata.OffsetTimeOriginal === "string" && /^[+-]\d{2}:\d{2}$/.test(metadata.OffsetTimeOriginal) ? metadata.OffsetTimeOriginal : "+09:00";
        takenAt = new Date(wall + offset).toISOString();
      }
    } catch { /* Missing EXIF is valid: selected date remains the fallback. */ }
  }
  let blob: Blob = file;
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: .85 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("画像を読み込めませんでした。");
    const resize = (max: number) => {
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("この端末では画像を変換できませんでした。");
      ctx.fillStyle = "#fff9f2"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", .85);
    };
    const full = resize(2048), thumb = resize(400);
    return { fullBase64: full.split(",")[1], thumbBase64: thumb.split(",")[1], takenAt, preview: thumb };
  } finally { URL.revokeObjectURL(url); }
}
