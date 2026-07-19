/**
 * ぴよログ .txt エクスポートファイルのパーサー
 *
 * 対応フォーマット（複数バージョン）:
 *   2024年01月15日(月)
 *   00:30 母乳 左5分右10分
 *   01:00 ミルク 120ml
 *   02:30 おむつ 小
 *   06:00 睡眠 起床
 *   12:00 体温 36.8
 */

export interface PiyoLogEntry {
  dateTime: Date;
  type: string; // We育 log type
  rawCategory: string;
  rawDetail: string;
  // typed fields
  breastLeftMin?: number;
  breastRightMin?: number;
  formulaMl?: number;
  bodyTemperature?: number;
  subType?: string;
  message?: string;
}

export interface PiyoImportResult {
  entries: PiyoLogEntry[];
  skipped: number;
  errors: string[];
}

// ─── Category matchers ────────────────────────────────────────────────────────

const CATEGORY_MAP: [RegExp, string][] = [
  [/母乳|授乳/, "breastfeed"],
  [/ミルク|粉ミルク/, "formula"],
  [/搾乳/, "expressed"],
  [/おむつ|オムツ|うんち|排便/, "diaper"],
  [/睡眠|ねんね/, "sleep"],
  [/体温|熱/, "temperature"],
  [/離乳食|食事|ごはん|おやつ/, "food"],
  [/薬|くすり|お薬/, "medicine"],
  [/お風呂|入浴|風呂/, "bath"],
  [/体重|身長|頭囲/, "growth"],
  [/体調|症状|病院/, "symptoms"],
];

function mapCategory(raw: string): string {
  for (const [re, type] of CATEGORY_MAP) {
    if (re.test(raw)) return type;
  }
  return "other";
}

// ─── Detail parsers ────────────────────────────────────────────────────────────

function parseBreastfeed(detail: string): Partial<PiyoLogEntry> {
  let leftMin: number | undefined;
  let rightMin: number | undefined;
  const leftMatch = detail.match(/左[：:]?\s*(\d+)/);
  const rightMatch = detail.match(/右[：:]?\s*(\d+)/);
  if (leftMatch) leftMin = parseInt(leftMatch[1]);
  if (rightMatch) rightMin = parseInt(rightMatch[1]);
  // Handle "10分" without side indication
  if (!leftMin && !rightMin) {
    const singleMatch = detail.match(/(\d+)\s*分/);
    if (singleMatch) leftMin = parseInt(singleMatch[1]);
  }
  return { breastLeftMin: leftMin, breastRightMin: rightMin };
}

function parseFormula(detail: string): Partial<PiyoLogEntry> {
  const mlMatch = detail.match(/(\d+)\s*(?:ml|ML|ｍｌ|cc)/i) || detail.match(/(\d+)/);
  return mlMatch ? { formulaMl: parseInt(mlMatch[1]) } : {};
}

function parseTemperature(detail: string): Partial<PiyoLogEntry> {
  const tempMatch = detail.match(/(3[0-9]\.\d)/);
  return tempMatch ? { bodyTemperature: parseFloat(tempMatch[1]) } : {};
}

function parseDiaper(raw: string, detail: string): Partial<PiyoLogEntry> {
  const combined = raw + detail;
  if (/うんち|便|大|poop/i.test(combined)) {
    return { type: "diaper_poop", subType: "poop" };
  }
  return { type: "diaper_wet", subType: "wet" };
}

function parseSleep(detail: string): Partial<PiyoLogEntry> {
  if (/起床|おはよう|目覚め|起き/i.test(detail)) {
    return { subType: "wake", message: "起床" };
  }
  return { subType: "sleep", message: "就寝" };
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a Japanese date string like "2024年01月15日(月)" or "2024/01/15"
 */
function parseJapaneseDate(line: string): Date | null {
  // 2024年01月15日 or 2024年1月15日
  const jpMatch = line.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (jpMatch) {
    return new Date(
      parseInt(jpMatch[1]),
      parseInt(jpMatch[2]) - 1,
      parseInt(jpMatch[3]),
    );
  }
  // 2024/01/15
  const slashMatch = line.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return new Date(
      parseInt(slashMatch[1]),
      parseInt(slashMatch[2]) - 1,
      parseInt(slashMatch[3]),
    );
  }
  return null;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parsePiyoLog(text: string): PiyoImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const entries: PiyoLogEntry[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let currentDate: Date | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^[━─=＝\-]+$/.test(line)) continue; // separator

    // Date header
    const date = parseJapaneseDate(line);
    if (date) {
      currentDate = date;
      continue;
    }

    if (!currentDate) continue;

    // Entry line: "00:30 母乳 左5分右10分"
    // Or with brackets: "[母乳] 00:30 左5分右10分"
    let timeStr: string | null = null;
    let category = "";
    let detail = "";

    // Format A: "HH:MM カテゴリ 詳細"
    const formatA = line.match(/^(\d{1,2}):(\d{2})\s+([^\s].*)$/);
    if (formatA) {
      timeStr = `${formatA[1].padStart(2, "0")}:${formatA[2]}`;
      const rest = formatA[3];
      // Split category from detail
      const spaceIdx = rest.search(/\s/);
      if (spaceIdx > -1) {
        category = rest.slice(0, spaceIdx);
        detail = rest.slice(spaceIdx + 1).trim();
      } else {
        category = rest;
      }
    }

    // Format B: "[カテゴリ] HH:MM 詳細" or "[カテゴリ（サブ）] HH:MM"
    const formatB = line.match(/^\[([^\]]+)\]\s*(\d{1,2}):(\d{2})\s*(.*)?$/);
    if (!formatA && formatB) {
      category = formatB[1];
      timeStr = `${formatB[2].padStart(2, "0")}:${formatB[3]}`;
      detail = (formatB[4] || "").trim();
    }

    // Format C: "2024/01/15 HH:MM カテゴリ 詳細"
    const formatC = line.match(/^\d{4}\/\d{2}\/\d{2}\s+(\d{1,2}):(\d{2})\s+([^\s].*)?$/);
    if (!formatA && !formatB && formatC) {
      const newDate = parseJapaneseDate(line);
      if (newDate) currentDate = newDate;
      timeStr = `${formatC[1].padStart(2, "0")}:${formatC[2]}`;
      const rest = (formatC[3] || "").trim();
      const spaceIdx = rest.search(/\s/);
      if (spaceIdx > -1) {
        category = rest.slice(0, spaceIdx);
        detail = rest.slice(spaceIdx + 1).trim();
      } else {
        category = rest;
      }
    }

    if (!timeStr) {
      skipped++;
      continue;
    }

    const [hh, mm] = timeStr.split(":").map(Number);
    const dateTime = new Date(currentDate);
    dateTime.setHours(hh, mm, 0, 0);

    const weYuType = mapCategory(category);
    if (weYuType === "other") {
      skipped++;
      continue;
    }

    const entry: PiyoLogEntry = {
      dateTime,
      type: weYuType,
      rawCategory: category,
      rawDetail: detail,
    };

    // Parse type-specific details
    if (weYuType === "breastfeed") {
      Object.assign(entry, parseBreastfeed(detail));
    } else if (weYuType === "formula") {
      Object.assign(entry, parseFormula(detail));
    } else if (weYuType === "temperature") {
      Object.assign(entry, parseTemperature(detail));
    } else if (weYuType === "diaper") {
      Object.assign(entry, parseDiaper(category, detail));
    } else if (weYuType === "sleep") {
      Object.assign(entry, parseSleep(detail));
    }

    entries.push(entry);
  }

  return { entries, skipped, errors };
}
