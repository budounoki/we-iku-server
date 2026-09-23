import notoSansJpCss from "@fontsource/noto-sans-jp/400.css?inline";
import {
  SupporterFieldValue,
  SupporterGrant,
  SupporterRecord,
  SUPPORTER_RECORD_LABELS,
  jstDateTime,
} from "./supporter";

export type SupporterExportResponse = {
  child: { id: number; name: string; birthday: string };
  records: SupporterRecord[];
  facilityName?: string;
  exportedAt: string;
  serverNow?: string;
  grants?: SupporterGrant[];
  periods: { startsAt: string; endsAt: string }[];
};

export const SUPPORTER_PRINT_FONT_ERROR = "日本語フォントを読み込めなかったため、印刷できません。画面を閉じて再試行してください。";
const FONT_SAMPLE = "サポート記録 施設 お子さま 利用期間 出力日 アレルギー 申告 観察";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function fieldText(value: SupporterFieldValue | undefined): string {
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function recordDetails(record: SupporterRecord) {
  const fields = record.fields || {};
  const details: string[] = [];
  if (record.message) details.push(record.message);
  for (const [key, label] of Object.entries({
    formulaMl: "粉ミルク", expressedMl: "搾乳", bodyTemperature: "体温",
    medicineName: "薬名", medicineDose: "量", durationMin: "時間", subType: "種別",
  })) {
    const value = fieldText(fields[key]);
    if (value) details.push(`${label}: ${value}${key.endsWith("Ml") ? "ml" : key === "durationMin" ? "分" : ""}`);
  }
  return details.join("／");
}

export function canPrintFreshExport(data: SupporterExportResponse, currentServerNow?: string): boolean {
  // `exportedAt` is a server-produced timestamp in the export contract; newer
  // servers may additionally expose `serverNow`.
  if (!data.exportedAt || !Array.isArray(data.periods)) return false;
  const now = Date.parse(currentServerNow || data.serverNow || data.exportedAt);
  return Number.isFinite(now) && data.periods.some((period) =>
    Date.parse(period.startsAt) <= now && now < Date.parse(period.endsAt)
  );
}

type PrintOptions = {
  /** Re-check server-backed child/grant access after the font network wait. */
  validateAfterFonts?: () => boolean | Promise<boolean>;
  fontTimeoutMs?: number;
};

function waitForFrame(printDocument: Document): Promise<void> {
  return new Promise((resolve) => {
    if (typeof printDocument.defaultView?.requestAnimationFrame === "function") {
      printDocument.defaultView.requestAnimationFrame(() => resolve());
    } else {
      printDocument.defaultView?.setTimeout(resolve, 0) ?? resolve();
    }
  });
}

async function loadPrintFont(printDocument: Document, timeoutMs: number): Promise<void> {
  const fontSet = printDocument.fonts;
  if (!fontSet) throw new Error(SUPPORTER_PRINT_FONT_ERROR);
  let timeout: number | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timeout = window.setTimeout(() => reject(new Error(SUPPORTER_PRINT_FONT_ERROR)), timeoutMs);
    });
    await Promise.race([fontSet.load(`400 10pt "Noto Sans JP"`, FONT_SAMPLE), timedOut]);
    await Promise.race([fontSet.ready, timedOut]);
    const loadedNotoFaces = Array.from(fontSet).filter((face) =>
      face.family.replace(/["']/g, "").split(",")[0].trim() === "Noto Sans JP" && face.status === "loaded",
    );
    if (!loadedNotoFaces.length || !fontSet.check(`400 10pt "Noto Sans JP"`, FONT_SAMPLE)) {
      throw new Error(SUPPORTER_PRINT_FONT_ERROR);
    }
  } catch {
    throw new Error(SUPPORTER_PRINT_FONT_ERROR);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

export async function printSupporterExport(data: SupporterExportResponse, options: PrintOptions = {}) {
  const records = Array.isArray(data.records) ? data.records : [];
  const rows = records.map((record) => `<tr>
    <td>${escapeHtml(jstDateTime(record.createdAt))}</td>
    <td>${escapeHtml(SUPPORTER_RECORD_LABELS[record.type] || record.type)}</td>
    <td>${escapeHtml(recordDetails(record))}</td>
    <td>${escapeHtml(record.recorderDisplayName)}</td>
  </tr>`).join("");
  const allergyReports = records.filter((record) => record.type === "allergy_report");
  const allergyObservations = records.filter((record) => record.type === "allergy_observation");
  const list = (records: SupporterRecord[]) => records.length
    ? `<ul>${records.map((record) => `<li>${escapeHtml(record.message || recordDetails(record))}</li>`).join("")}</ul>`
    : "<p>記録なし</p>";
  const periods = data.periods.map((period) => `${jstDateTime(period.startsAt)}〜${jstDateTime(period.endsAt)}`).join("、");
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>サポート記録</title>
  <style id="supporter-print-fonts">${notoSansJpCss}</style><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif;font-weight:400;color:#222;font-size:10pt;line-height:1.5}h1,h2,h3,th{font-weight:400}h1{font-size:17pt;margin:0 0 5px}.meta{margin:0 0 16px;color:#444;font-size:9pt}.notice{background:#fff8e8;border:1px solid #e5bf69;padding:8px;margin:10px 0}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #aaa;padding:6px;vertical-align:top;word-break:break-word}th{background:#f0ebf6;text-align:left}tr{break-inside:avoid;page-break-inside:avoid}h2{font-size:12pt;border-left:4px solid #805aaa;padding-left:7px;margin:17px 0 6px}.footer{margin-top:18px;border-top:1px solid #ccc;padding-top:6px;font-size:8pt;color:#666}@media print{thead{display:table-header-group}}</style>
  </head><body><h1>サポート記録</h1><div class="meta">施設: ${escapeHtml(data.facilityName || "ぶどうの木")}<br>お子さま: ${escapeHtml(data.child.name)} ／ 生年月日: ${escapeHtml(data.child.birthday)}<br>利用期間（JST）: ${escapeHtml(periods)}<br>出力日（JST）: ${escapeHtml(jstDateTime(data.exportedAt))}</div>
  <table><thead><tr><th>時刻（JST）</th><th>種別</th><th>内容</th><th>記録者</th></tr></thead><tbody>${rows || "<tr><td colspan=4>記録なし</td></tr>"}</tbody></table>
  <h2>アレルギーの申告</h2>${list(allergyReports)}<h2>アレルギーに関する観察</h2>${list(allergyObservations)}<div class="notice">上記のアレルギー情報は申告・観察の記録であり、医学的診断ではありません。</div><div class="footer">We育 ${escapeHtml(data.facilityName || "ぶどうの木")}</div></body></html>`;
  // Keep the same browser-print flow as the existing reports. `noopener` would
  // make several mobile browsers return no writable Window object here.
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("印刷ウィンドウを開けませんでした");
  printWindow.document.write(html);
  printWindow.document.close();
  try {
    await loadPrintFont(printWindow.document, options.fontTimeoutMs ?? 8_000);
    if (options.validateAfterFonts && !(await options.validateAfterFonts())) {
      throw new Error("利用期限を確認できないため、印刷できません。");
    }
    await waitForFrame(printWindow.document);
    printWindow.print();
  } catch (error) {
    printWindow.close();
    throw error;
  }
}