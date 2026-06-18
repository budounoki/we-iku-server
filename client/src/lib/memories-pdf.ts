import { format, parseISO, differenceInDays, differenceInMonths } from "date-fns";
import { ja } from "date-fns/locale";

function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

function getMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}年${parseInt(m)}月`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MILESTONE_TYPES = new Set(["milestone", "achievement", "words", "hobby"]);
const MILESTONE_LABELS: Record<string, string> = {
  milestone: "はじめて",
  achievement: "できた！",
  words: "ことば",
  hobby: "きょうみ",
};
const MILESTONE_COLORS: Record<string, string> = {
  milestone: "#805AAA",
  achievement: "#059669",
  words: "#2563EB",
  hobby: "#C026D3",
};

interface MemoriesPdfOptions {
  childName: string;
  birthday: string | null;
  allLogs: any[];
  familyId: string;
}

export function generateMemoriesPdf({ childName, birthday, allLogs }: MemoriesPdfOptions) {
  const today = new Date();

  const daysOld = birthday ? differenceInDays(today, parseISO(birthday)) : null;
  const monthsOld = birthday ? differenceInMonths(today, parseISO(birthday)) : null;

  const ageText = monthsOld !== null
    ? monthsOld >= 12
      ? `${Math.floor(monthsOld / 12)}歳${monthsOld % 12}ヶ月`
      : `生後${monthsOld}ヶ月`
    : "";

  const milestoneLogs = allLogs
    .filter((l: any) => MILESTONE_TYPES.has(l.type) && l.message)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const thankLogs = allLogs
    .filter((l: any) => l.type === "thanks" && l.message)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const monthSet = new Set<string>();
  allLogs.forEach((l: any) => monthSet.add(monthKey(new Date(l.createdAt))));
  const months = Array.from(monthSet).sort();

  const milestonesByMonth: Record<string, any[]> = {};
  for (const log of milestoneLogs) {
    const key = monthKey(new Date(log.createdAt));
    if (!milestonesByMonth[key]) milestonesByMonth[key] = [];
    milestonesByMonth[key].push(log);
  }

  const monthlyStats: Record<string, { milkCount: number; breastCount: number; diaperCount: number; sleepMin: number }> = {};
  for (const key of months) {
    const [y, m] = key.split("-").map(Number);
    const monthLogs = allLogs.filter((l: any) => {
      const d = new Date(l.createdAt);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    });
    const milkLogs = monthLogs.filter((l: any) => l.type === "milk");
    monthlyStats[key] = {
      milkCount: milkLogs.filter((l: any) => l.subType === "formula" || l.subType === "mixed").length,
      breastCount: milkLogs.filter((l: any) => l.subType === "breast" || l.subType === "mixed").length,
      diaperCount: monthLogs.filter((l: any) => l.type === "diaper").length,
      sleepMin: 0,
    };
  }

  const coverBg = "#F5EEF8";
  const purple = "#805AAA";
  const green = "#16a34a";

  let html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(childName)}の思い出ブック</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Hiragino Maru Gothic Pro', 'Hiragino Sans', 'Meiryo', Arial, sans-serif; color: #333; margin: 0; padding: 0; line-height: 1.7; }

  .cover { background: ${coverBg}; text-align: center; padding: 40mm 20mm; min-height: 200mm; border-radius: 8px; }
  .cover-app { font-size: 11px; color: #888; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
  .cover-title { font-size: 28px; font-weight: 900; color: ${purple}; margin: 0 0 6px 0; }
  .cover-sub { font-size: 14px; color: #555; margin-bottom: 30px; }
  .cover-name { font-size: 38px; font-weight: 900; color: #333; margin: 0 0 12px 0; }
  .cover-age { display: inline-block; background: ${purple}; color: white; border-radius: 999px; padding: 6px 20px; font-size: 14px; font-weight: bold; margin-bottom: 8px; }
  .cover-days { font-size: 12px; color: #666; margin-bottom: 30px; }
  .cover-date { font-size: 11px; color: #aaa; margin-top: 40px; }
  .cover-heart { font-size: 40px; margin-bottom: 16px; }

  .section { margin-top: 12mm; }
  .section-title { font-size: 16px; font-weight: 900; color: ${purple}; border-bottom: 3px solid #E8D5F5; padding-bottom: 4px; margin-bottom: 8px; }
  .section-sub { font-size: 11px; color: #888; margin-bottom: 12px; }

  .month-block { margin-bottom: 10mm; break-inside: avoid; }
  .month-label { font-size: 12px; font-weight: bold; color: ${purple}; background: #F3E8FF; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 6px; }

  .milestone-item { display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; break-inside: avoid; }
  .milestone-badge { font-size: 9px; font-weight: bold; color: white; padding: 2px 7px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
  .milestone-date { font-size: 10px; color: #888; flex-shrink: 0; min-width: 40px; margin-top: 1px; }
  .milestone-text { font-size: 11px; color: #333; }

  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
  .stat-box { background: #F9F5FF; border-radius: 8px; padding: 8px 10px; text-align: center; }
  .stat-num { font-size: 20px; font-weight: 900; color: ${purple}; line-height: 1.1; }
  .stat-unit { font-size: 10px; color: #888; }
  .stat-label { font-size: 9px; color: #aaa; margin-top: 2px; }

  .no-data { color: #bbb; font-size: 11px; font-style: italic; padding: 4px 0; }

  .thank-item { padding: 6px 10px; border-left: 3px solid ${green}; margin-bottom: 6px; break-inside: avoid; background: #F0FDF4; border-radius: 0 6px 6px 0; }
  .thank-date { font-size: 9px; color: #888; }
  .thank-text { font-size: 11px; color: #333; }
  .thank-from { font-size: 10px; color: ${green}; font-weight: bold; }

  .footer { text-align: center; color: #ccc; font-size: 9px; margin-top: 16mm; padding-top: 6mm; border-top: 1px solid #eee; }

  .page-break { page-break-before: always; }
  .no-break { break-inside: avoid; }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-app">We育 by ぶどうの木</div>
  <div class="cover-title">思い出ブック</div>
  <div class="cover-sub">大切な育児の記録</div>
  <div class="cover-heart">&#9825;</div>
  <div class="cover-name">${escapeHtml(childName)}</div>`;

  if (birthday) {
    html += `<div class="cover-age">${escapeHtml(ageText)}</div>`;
    if (daysOld !== null) {
      html += `<div class="cover-days">誕生日 ${format(parseISO(birthday), "yyyy年M月d日", { locale: ja })}（生後${daysOld}日目）</div>`;
    }
  }

  html += `<div class="cover-date">作成日: ${format(today, "yyyy年M月d日", { locale: ja })}</div>
</div>`;

  html += `<div class="page-break"></div>`;
  html += `<div class="section">
  <div class="section-title">&#9733; はじめて・できた・ことばの記録</div>
  <div class="section-sub">${escapeHtml(childName)}の成長の瞬間をまとめました</div>`;

  const milestoneMonths = months.filter((k) => milestonesByMonth[k]);
  if (milestoneMonths.length === 0) {
    html += `<div class="no-data">まだはじめての記録がありません</div>`;
  } else {
    for (const key of milestoneMonths) {
      const logs = milestonesByMonth[key];
      html += `<div class="month-block">
  <div class="month-label">${escapeHtml(getMonthLabel(key))}</div>`;
      for (const log of logs) {
        const typeName = MILESTONE_LABELS[log.type] || log.type;
        const color = MILESTONE_COLORS[log.type] || purple;
        const dateStr = format(new Date(log.createdAt), "d日", { locale: ja });
        const text = log.message
          ?.replace(/^(はじめて|できた|ことば|きょうみ|マイルストーン)[：:]\s*/u, "")
          ?.replace(/を記録しました！?$/, "")
          ?.trim() || log.message || "";
        html += `<div class="milestone-item">
  <span class="milestone-badge" style="background:${color}">${escapeHtml(typeName)}</span>
  <span class="milestone-date">${escapeHtml(dateStr)}</span>
  <span class="milestone-text">${escapeHtml(text)}</span>
</div>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>`;

  html += `<div class="page-break"></div>`;
  html += `<div class="section">
  <div class="section-title">&#128200; 月別育児サマリー</div>
  <div class="section-sub">各月の授乳・おむつ回数</div>`;

  if (months.length === 0) {
    html += `<div class="no-data">記録がありません</div>`;
  } else {
    for (const key of months) {
      const stats = monthlyStats[key];
      const totalMilk = stats.milkCount + stats.breastCount;
      if (totalMilk === 0 && stats.diaperCount === 0) continue;
      html += `<div class="no-break" style="margin-bottom:8px;">
  <div class="month-label">${escapeHtml(getMonthLabel(key))}</div>
  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-num">${stats.breastCount}<span class="stat-unit">回</span></div>
      <div class="stat-label">母乳</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${stats.milkCount}<span class="stat-unit">回</span></div>
      <div class="stat-label">ミルク</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${stats.diaperCount}<span class="stat-unit">回</span></div>
      <div class="stat-label">おむつ</div>
    </div>
  </div>
</div>`;
    }
  }
  html += `</div>`;

  if (thankLogs.length > 0) {
    html += `<div class="page-break"></div>`;
    html += `<div class="section">
  <div class="section-title">&#10084; ありがとうメッセージ</div>
  <div class="section-sub">パートナーへ伝えた感謝の気持ち</div>`;
    for (const log of thankLogs.slice(0, 30)) {
      const dateStr = format(new Date(log.createdAt), "yyyy年M月d日", { locale: ja });
      const from = log.userId === "papa" ? "パパ" : "ママ";
      const text = log.message?.replace(/から「ありがとう」.*$/, "")?.trim() || log.message || "";
      html += `<div class="thank-item">
  <div class="thank-from">${escapeHtml(from)} より</div>
  <div class="thank-text">${escapeHtml(text)}</div>
  <div class="thank-date">${escapeHtml(dateStr)}</div>
</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="footer">
  We育（ぶどうの木）- ${escapeHtml(childName)}の思い出ブック - ${format(today, "yyyy年M月d日", { locale: ja })} 作成
</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
      setTimeout(() => printWindow.close(), 60000);
    }, 800);
  }
}
