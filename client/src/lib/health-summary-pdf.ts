import { format, differenceInYears, differenceInMonths, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

const vaccineList = [
  { id: '5mix_1', name: '五種混合(1回目)' },
  { id: 'pcv_1', name: '肺炎球菌(1回目)' },
  { id: 'hepB_1', name: 'B型肝炎(1回目)' },
  { id: 'rota_1', name: 'ロタウイルス(1回目)' },
  { id: '5mix_2', name: '五種混合(2回目)' },
  { id: 'pcv_2', name: '肺炎球菌(2回目)' },
  { id: 'hepB_2', name: 'B型肝炎(2回目)' },
  { id: 'rota_2', name: 'ロタウイルス(2回目)' },
  { id: 'rota_3', name: 'ロタウイルス(3回目)' },
  { id: '5mix_3', name: '五種混合(3回目)' },
  { id: 'pcv_3', name: '肺炎球菌(3回目)' },
  { id: 'bcg', name: 'BCG' },
  { id: 'hepB_3', name: 'B型肝炎(3回目)' },
  { id: 'mr_1', name: 'MR 麻しん風しん(1期)' },
  { id: 'vzv_1', name: '水痘(1回目)' },
  { id: 'mumps_1', name: 'おたふくかぜ(1回目)' },
  { id: 'pcv_boost', name: '肺炎球菌(追加)' },
  { id: 'vzv_2', name: '水痘(2回目)' },
  { id: '5mix_boost', name: '五種混合(追加)' },
  { id: 'je_1', name: '日本脳炎(1回目)' },
  { id: 'je_2', name: '日本脳炎(2回目)' },
  { id: 'je_boost', name: '日本脳炎(追加)' },
  { id: 'mr_2', name: 'MR 麻しん風しん(2期)' },
  { id: 'mumps_2', name: 'おたふくかぜ(2回目)' },
];

interface HealthSummaryData {
  childName: string;
  birthday: string | null;
  gender: string | null;
  bloodType: string | null;
  vaccinationLogs: any[];
  healthRecords: any[];
}

export function generateHealthSummaryPdf(data: HealthSummaryData) {
  const { childName, birthday, gender, bloodType, vaccinationLogs, healthRecords } = data;

  let ageText = "";
  if (birthday) {
    const bd = parseISO(birthday);
    const years = differenceInYears(new Date(), bd);
    const months = differenceInMonths(new Date(), bd) % 12;
    if (years > 0) {
      ageText = `${years}歳${months}ヶ月`;
    } else {
      ageText = `生後${differenceInMonths(new Date(), bd)}ヶ月`;
    }
  }

  const genderText = gender === "boy" ? "男" : gender === "girl" ? "女" : "";

  const completedVaccines = vaccinationLogs
    .map((log: any) => {
      const info = vaccineList.find(v => v.id === log.subType);
      return {
        name: info?.name || log.subType || "不明",
        date: log.createdAt ? format(new Date(log.createdAt), "yyyy年M月d日") : "",
      };
    })
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  const allergies = healthRecords.filter((r: any) => r.type === "allergy");
  const medicalHistory = healthRecords.filter((r: any) => r.type === "medical_history");
  const healthNotes = healthRecords.filter((r: any) => r.type === "health_note");

  let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>健康データ・サマリー - ${childName}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
    font-size: 10.5pt;
    color: #222;
    line-height: 1.7;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .header h1 {
    font-size: 16pt;
    letter-spacing: 2px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .header .subtitle {
    font-size: 9pt;
    color: #666;
  }
  .section {
    margin-bottom: 14px;
  }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    border-left: 4px solid #805AAA;
    padding-left: 8px;
    margin-bottom: 6px;
    color: #333;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 5px 8px;
    font-size: 9.5pt;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #F5F0FA;
    font-weight: 600;
    width: 130px;
    white-space: nowrap;
  }
  .vaccine-table th {
    width: auto;
  }
  .vaccine-table td, .vaccine-table th {
    padding: 4px 8px;
    font-size: 9pt;
  }
  .vaccine-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .vaccine-grid .item {
    border-bottom: 1px solid #eee;
    padding: 3px 8px;
    font-size: 9pt;
    display: flex;
    justify-content: space-between;
  }
  .vaccine-grid .item:nth-child(odd) {
    border-right: 1px solid #eee;
  }
  .note-item {
    padding: 4px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 9.5pt;
  }
  .note-item:last-child { border-bottom: none; }
  .note-title { font-weight: 600; }
  .note-detail { color: #555; margin-left: 4px; }
  .note-date { color: #999; font-size: 8.5pt; margin-left: 8px; }
  .empty { color: #999; font-style: italic; font-size: 9pt; padding: 4px 0; }
  .footer {
    margin-top: 24px;
    text-align: right;
    font-size: 8.5pt;
    color: #999;
    border-top: 1px solid #ddd;
    padding-top: 6px;
  }
</style>
</head>
<body>
<div class="header">
  <h1>健康データ・サマリー</h1>
  <div class="subtitle">入園・進級提出用</div>
</div>

<div class="section">
  <div class="section-title">基本情報</div>
  <table>
    <tr><th>氏名</th><td>${childName}</td></tr>
    <tr><th>生年月日</th><td>${birthday ? format(parseISO(birthday), "yyyy年M月d日", { locale: ja }) : "未登録"}</td></tr>
    <tr><th>年齢</th><td>${ageText || "未登録"}</td></tr>
    <tr><th>性別</th><td>${genderText || "未登録"}</td></tr>
    <tr><th>血液型</th><td>${bloodType || "未登録"}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">予防接種履歴（接種済のみ）</div>`;

  if (completedVaccines.length === 0) {
    html += `<div class="empty">接種記録なし</div>`;
  } else {
    html += `<table class="vaccine-table"><tr><th>ワクチン名</th><th>接種日</th></tr>`;
    for (const v of completedVaccines) {
      html += `<tr><td>${v.name}</td><td>${v.date}</td></tr>`;
    }
    html += `</table>`;
  }

  html += `
</div>

<div class="section">
  <div class="section-title">アレルギー情報</div>`;

  if (allergies.length === 0) {
    html += `<div class="empty">登録なし</div>`;
  } else {
    html += `<table><tr><th>品目</th><td>`;
    html += allergies.map((a: any) => {
      let text = a.title;
      if (a.detail) text += `（${a.detail}）`;
      return text;
    }).join("、");
    html += `</td></tr></table>`;
  }

  html += `
</div>

<div class="section">
  <div class="section-title">既往歴</div>`;

  if (medicalHistory.length === 0) {
    html += `<div class="empty">登録なし</div>`;
  } else {
    for (const h of medicalHistory) {
      html += `<div class="note-item">`;
      html += `<span class="note-title">${h.title}</span>`;
      if (h.detail) html += `<span class="note-detail">${h.detail}</span>`;
      if (h.recordedAt) html += `<span class="note-date">(${format(parseISO(h.recordedAt), "yyyy年M月")})</span>`;
      html += `</div>`;
    }
  }

  html += `
</div>

<div class="section">
  <div class="section-title">体質・園への申し送り</div>`;

  if (healthNotes.length === 0) {
    html += `<div class="empty">登録なし</div>`;
  } else {
    for (const n of healthNotes) {
      html += `<div class="note-item">`;
      html += `<span class="note-title">${n.title}</span>`;
      if (n.detail) html += `<span class="note-detail">: ${n.detail}</span>`;
      html += `</div>`;
    }
  }

  html += `
</div>

<div class="footer">
  We育（ぶどうの木） 出力日: ${format(new Date(), "yyyy年M月d日")}
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
