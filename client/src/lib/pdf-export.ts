import { format, subDays, isSameDay, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";

function getLogLabel(type: string, subType?: string): string {
  switch (type) {
    case "milk":
      if (subType === "breast") return "母乳";
      if (subType === "formula") return "ミルク";
      return "ミルク";
    case "diaper": return "おむつ";
    case "food": return "離乳食";
    case "temp": return "体温";
    case "toilet": return "トイレ";
    case "meal": return "ごはん";
    case "symptom": return "症状メモ";
    default: return type;
  }
}

function getLogDetail(log: any): string {
  if (log.type === "milk") {
    if (log.subType === "breast") {
      const parts = [];
      if (log.breastLeftMin) parts.push(`左${log.breastLeftMin}分`);
      if (log.breastRightMin) parts.push(`右${log.breastRightMin}分`);
      return parts.join(" ");
    }
    if (log.subType === "formula") return log.formulaMl ? `${log.formulaMl}ml` : "";
  }
  if (log.type === "diaper") {
    return log.subType === "pee" ? "おしっこ" : log.subType === "poop" ? "うんち" : log.subType === "both" ? "両方" : "";
  }
  if (log.type === "food") return log.foodItems || "";
  if (log.type === "temp") return `${log.bodyTemperature}°C`;
  if (log.type === "toilet") {
    const labels: Record<string, string> = { success: "成功", fail: "失敗", prompted: "誘った" };
    return labels[log.subType] || "";
  }
  if (log.type === "meal") {
    const labels: Record<string, string> = { full: "完食", half: "半分", refused: "イヤイヤ" };
    return labels[log.subType] || "";
  }
  if (log.type === "symptom") return log.message || "";
  return "";
}

interface WeBoardMessage {
  userId: string;
  message: string;
  createdAt: string;
}

async function fetchWeBoardMessages(familyId: string): Promise<WeBoardMessage[]> {
  try {
    const res = await fetch(`/api/we-board/${familyId}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateTimelinePdf(
  familyId: string,
  allLogs: any[],
  allSleepSessions: any[],
  today: Date
) {
  const weBoardMessages = await fetchWeBoardMessages(familyId);

  const PDF_TYPES = ["milk", "diaper", "food", "temp", "toilet", "meal", "symptom"];
  const dates: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(subDays(today, i));
  }

  let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>We育 1週間レポート</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', 'Meiryo', sans-serif; font-size: 11px; color: #333; line-height: 1.6; }
  h1 { font-size: 18px; color: #805AAA; margin: 0 0 4px 0; }
  h2 { font-size: 14px; color: #805AAA; margin: 16px 0 6px 0; border-bottom: 2px solid #E8D5F5; padding-bottom: 3px; }
  .subtitle { color: #888; font-size: 11px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #F3E8FF; color: #805AAA; padding: 6px 8px; text-align: left; font-size: 10px; border-bottom: 1px solid #D8B4FE; }
  td { padding: 5px 8px; border-bottom: 1px solid #F0F0F0; font-size: 10px; }
  tr:nth-child(even) td { background: #FDFCFE; }
  .user-papa { color: #6B46C1; font-weight: bold; }
  .user-mama { color: #059669; font-weight: bold; }
  .sleep-row td { background: #F3E8FF !important; }
  .section-weboard { margin-top: 16px; }
  .wb-msg { padding: 4px 8px; margin: 2px 0; border-radius: 8px; font-size: 10px; }
  .wb-papa { background: #F3E8FF; }
  .wb-mama { background: #ECFDF5; }
  .no-data { color: #aaa; font-style: italic; padding: 6px 8px; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
<h1>We育 1週間レポート</h1>
<div class="subtitle">${format(dates[0], "yyyy年M月d日", { locale: ja })} ～ ${format(dates[6], "yyyy年M月d日", { locale: ja })}</div>
`;

  for (const date of dates) {
    const dayLabel = format(date, "M月d日 (EEE)", { locale: ja });
    const isFirstDate = isSameDay(date, dates[0]);
    html += `<h2${!isFirstDate ? "" : ""}>${dayLabel}</h2>`;

    const dayLogs = allLogs
      .filter((l: any) => {
        const created = new Date(l.createdAt);
        return isSameDay(created, date) && PDF_TYPES.includes(l.type);
      })
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const daySleep = allSleepSessions.filter((s: any) => {
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : new Date();
      return isSameDay(start, date) || isSameDay(end, date);
    });

    const dayWeBoard = weBoardMessages.filter((m: WeBoardMessage) => {
      const created = new Date(m.createdAt);
      return isSameDay(created, date);
    });

    if (dayLogs.length === 0 && daySleep.length === 0 && dayWeBoard.length === 0) {
      html += `<div class="no-data">記録なし</div>`;
      continue;
    }

    if (daySleep.length > 0 || dayLogs.length > 0) {
      html += `<table><tr><th>時刻</th><th>種別</th><th>内容</th><th>記録者</th></tr>`;

      for (const session of daySleep) {
        const start = new Date(session.startedAt);
        const end = session.endedAt ? new Date(session.endedAt) : null;
        const startTime = format(start, "HH:mm");
        const endTime = end ? format(end, "HH:mm") : "継続中";
        const dur = session.durationMin ? `${Math.floor(session.durationMin / 60)}h${session.durationMin % 60}m` : "";
        const user = session.createdBy === "papa" ? "パパ" : "ママ";
        const userClass = session.createdBy === "papa" ? "user-papa" : "user-mama";
        html += `<tr class="sleep-row"><td>${startTime}～${endTime}</td><td>睡眠</td><td>${dur}</td><td class="${userClass}">${user}</td></tr>`;
      }

      for (const log of dayLogs) {
        const created = new Date(log.createdAt);
        const time = format(created, "HH:mm");
        const label = getLogLabel(log.type, log.subType);
        const detail = getLogDetail(log);
        const user = log.userId === "papa" ? "パパ" : "ママ";
        const userClass = log.userId === "papa" ? "user-papa" : "user-mama";
        html += `<tr><td>${time}</td><td>${label}</td><td>${detail}</td><td class="${userClass}">${user}</td></tr>`;
      }

      html += `</table>`;
    }

    if (dayWeBoard.length > 0) {
      html += `<div class="section-weboard"><strong>Weボード</strong>`;
      for (const msg of dayWeBoard) {
        const time = format(new Date(msg.createdAt), "HH:mm");
        const user = msg.userId === "papa" ? "パパ" : "ママ";
        const cls = msg.userId === "papa" ? "wb-papa" : "wb-mama";
        html += `<div class="wb-msg ${cls}">${time} ${user}: ${msg.message}</div>`;
      }
      html += `</div>`;
    }
  }

  html += `
<div style="margin-top: 20px; text-align: center; color: #aaa; font-size: 9px;">
  We育 (ぶどうの木) - ${format(new Date(), "yyyy年M月d日 HH:mm")} 出力
</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
      setTimeout(() => {
        printWindow.close();
      }, 60000);
    }, 500);
  }
}
