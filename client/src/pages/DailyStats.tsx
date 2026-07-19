import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, Moon, Milk, Droplets, TrendingUp, TrendingDown, Minus, Sunrise, Stars, UserX, X, ChevronDown, ChevronUp, Timer, Zap } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/Navigation";
import { useLogs, useSleepSessions, useSettings } from "@/hooks/use-app-data";
import { useActiveChild } from "@/hooks/use-active-child";
import { getExcludedDates, toggleExcludedDate, toDateStr } from "@/lib/excluded-dates";

function minutesToHM(mins: number) {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 && m > 0 ? `${h}h${m}m` : h > 0 ? `${h}h` : `${m}m`;
}

function calcSleepMinutesForDay(sessions: any[], date: Date): number {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = endOfDay(date).getTime();
  let total = 0;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const sStart = new Date(s.startedAt).getTime();
    const sEnd = new Date(s.endedAt).getTime();
    const overlap = Math.max(0, Math.min(sEnd, dayEnd) - Math.max(sStart, dayStart));
    total += Math.round(overlap / 60000);
  }
  return total;
}

function calcHourlyHeatmap(sessions: any[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const s of sessions) {
    if (!s.endedAt) continue;
    let cur = new Date(s.startedAt).getTime();
    const end = new Date(s.endedAt).getTime();
    while (cur < end) {
      const hour = new Date(cur).getHours();
      const nextHour = new Date(cur);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(hour + 1);
      const segEnd = Math.min(end, nextHour.getTime());
      buckets[hour] += Math.round((segEnd - cur) / 60000);
      cur = segEnd;
    }
  }
  return buckets;
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="flex items-center gap-0.5 text-[10px] font-bold text-gray-400"><Minus className="w-3 h-3" />同じ</span>;
  const up = diff > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? "text-green-500" : "text-red-400"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{diff}
    </span>
  );
}

function SleepDeltaBadge({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (Math.abs(diff) < 1) return null;
  const up = diff > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? "text-green-500" : "text-red-400"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{minutesToHM(Math.abs(diff))}
    </span>
  );
}

function BarChart({ data, maxVal, color, unit, isTime }: {
  data: { label: string; value: number; isToday?: boolean; excluded?: boolean }[];
  maxVal: number;
  color: string;
  unit?: string;
  isTime?: boolean;
}) {
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => {
        const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
        return (
          <div key={d.label} className="flex flex-col items-center gap-1 flex-1">
            <span className={`text-[10px] font-bold ${d.excluded ? "text-gray-300 line-through" : "text-gray-500"}`}>
              {d.excluded ? "—" : isTime ? (d.value > 0 ? minutesToHM(d.value) : "-") : d.value > 0 ? d.value : "-"}
            </span>
            <div className="w-full rounded-t-lg relative bg-gray-100" style={{ height: "64px" }}>
              {d.excluded ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <X className="w-3 h-3 text-gray-300" />
                </div>
              ) : (
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all ${color} ${d.isToday ? "opacity-100" : "opacity-60"}`}
                  style={{ height: `${pct}%` }}
                />
              )}
            </div>
            <span className={`text-[10px] font-bold ${d.excluded ? "text-gray-300 line-through" : d.isToday ? "text-purple-700" : "text-gray-400"}`}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapRow({ buckets }: { buckets: number[] }) {
  const maxVal = Math.max(...buckets, 1);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const isNight = (h: number) => h >= 18 || h < 6;

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5">
        {buckets.map((val, h) => {
          const intensity = val / maxVal;
          const opacity = Math.round(intensity * 9) / 9;
          const night = isNight(h);
          const isSelected = selectedHour === h;
          const baseColor = night
            ? `rgba(79, 60, 180, ${0.08 + opacity * 0.82})`
            : `rgba(56, 160, 100, ${0.08 + opacity * 0.82})`;
          return (
            <button
              key={h}
              data-testid={`heatmap-cell-${h}`}
              className="flex-1 rounded-sm transition-all focus:outline-none"
              style={{
                height: "32px",
                backgroundColor: val === 0 ? "#F3F4F6" : baseColor,
                outline: isSelected ? "2px solid #805AAA" : "none",
                outlineOffset: "1px",
              }}
              onClick={() => setSelectedHour(isSelected ? null : h)}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 font-bold px-0.5">
        <span>0</span><span>3</span><span>6</span><span>9</span>
        <span>12</span><span>15</span><span>18</span><span>21</span><span>23</span>
      </div>
      <div className="flex gap-3 text-[10px] text-gray-400 font-medium">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "rgba(79,60,180,0.5)" }} />
          夜間（18〜6時）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "rgba(56,160,100,0.5)" }} />
          昼間（6〜18時）
        </span>
      </div>
      {selectedHour !== null && (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-2xl px-3 py-2">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isNight(selectedHour) ? "bg-indigo-100" : "bg-green-100"}`}>
            {isNight(selectedHour)
              ? <Moon className="w-3.5 h-3.5 text-indigo-500" />
              : <Sunrise className="w-3.5 h-3.5 text-green-500" />}
          </div>
          <div>
            <p className="text-xs font-black text-gray-700">
              {selectedHour}時台〜{selectedHour + 1}時台
              <span className="ml-1 text-[10px] font-bold text-gray-400">
                （{isNight(selectedHour) ? "夜間" : "昼間"}）
              </span>
            </p>
            <p className="text-sm font-black text-purple-700">
              {buckets[selectedHour] > 0 ? minutesToHM(buckets[selectedHour]) : "データなし"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DailyStats() {
  const [, setLocation] = useLocation();
  const { activeChild } = useActiveChild();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: logs = [] } = useLogs(familyId);
  const { data: sessions = [] } = useSleepSessions(familyId);

  const [excludedDates, setExcludedDates] = useState<string[]>(() => getExcludedDates());
  const [showExcludePanel, setShowExcludePanel] = useState(false);
  const [showStimulationPanel, setShowStimulationPanel] = useState(false);

  const today = startOfDay(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i)), []);
  const last14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i)), []);

  const handleToggleDate = (dateStr: string) => {
    const next = toggleExcludedDate(dateStr);
    setExcludedDates(next);
  };

  const childLogs = useMemo(() => {
    const childId = activeChild?.id;
    if (!childId) return logs;
    return logs.filter((l: any) => l.childId === childId);
  }, [logs, activeChild]);

  const childSessions = useMemo(() => {
    const childId = activeChild?.id;
    if (!childId) return sessions;
    return sessions.filter((s: any) => s.childId === childId);
  }, [sessions, activeChild]);

  // 除外日を除いたセッション・ログ
  const filteredSessions = useMemo(() => {
    if (excludedDates.length === 0) return childSessions;
    return childSessions.filter((s: any) => {
      const dateStr = format(new Date(s.startedAt), "yyyy-MM-dd");
      return !excludedDates.includes(dateStr);
    });
  }, [childSessions, excludedDates]);

  const filteredLogs = useMemo(() => {
    if (excludedDates.length === 0) return childLogs;
    return childLogs.filter((l: any) => {
      const dateStr = format(new Date(l.createdAt), "yyyy-MM-dd");
      return !excludedDates.includes(dateStr);
    });
  }, [childLogs, excludedDates]);

  const dailyStats = useMemo(() => {
    return days.map((date) => {
      const dateStr = toDateStr(date);
      const excluded = excludedDates.includes(dateStr);
      const dayLogs = filteredLogs.filter((l: any) => isSameDay(new Date(l.createdAt), date));
      const sleepMins = excluded ? 0 : calcSleepMinutesForDay(filteredSessions, date);
      const milkLogs = dayLogs.filter((l: any) => l.type === "milk");
      const milkCount = milkLogs.length;
      const breastCount = milkLogs.filter((l: any) => l.subType === "breast" || l.subType === "mixed").length;
      const formulaTotalMl = milkLogs.reduce((sum: number, l: any) => sum + (l.formulaMl || 0), 0);
      const peeCount = dayLogs.filter((l: any) => l.type === "diaper" && (l.subType === "pee" || l.subType === "both")).length;
      const poopCount = dayLogs.filter((l: any) => l.type === "diaper" && (l.subType === "poop" || l.subType === "both")).length;
      const expressCount = dayLogs.filter((l: any) => l.type === "express").length;
      const stimulationCount = breastCount + expressCount;
      return { date, dateStr, excluded, sleepMins, milkCount, breastCount, formulaTotalMl, peeCount, poopCount, expressCount, stimulationCount };
    });
  }, [filteredLogs, filteredSessions, days, excludedDates]);

  const last14Sessions = useMemo(() => {
    const cutoff = subDays(today, 13).getTime();
    return filteredSessions.filter((s: any) => s.endedAt && new Date(s.startedAt).getTime() >= cutoff);
  }, [filteredSessions]);

  const heatmap = useMemo(() => calcHourlyHeatmap(last14Sessions), [last14Sessions]);

  const todayStat = dailyStats[6];
  const yesterdayStat = dailyStats[5];
  const weekAgoStat = dailyStats[0];

  const dayLabels = days.map((d, i) => {
    if (i === 6) return "今日";
    if (i === 5) return "昨日";
    return format(d, "M/d");
  });

  const sleepBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.sleepMins, isToday: i === 6, excluded: s.excluded }));
  const milkBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.milkCount, isToday: i === 6, excluded: s.excluded }));
  const formulaMlBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.formulaTotalMl, isToday: i === 6, excluded: s.excluded }));
  const peeBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.peeCount, isToday: i === 6, excluded: s.excluded }));
  const poopBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.poopCount, isToday: i === 6, excluded: s.excluded }));
  const breastBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.breastCount, isToday: i === 6, excluded: s.excluded }));
  const expressBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.expressCount, isToday: i === 6, excluded: s.excluded }));
  const stimulationBarData = dailyStats.map((s, i) => ({ label: dayLabels[i], value: s.stimulationCount, isToday: i === 6, excluded: s.excluded }));

  const includedSleepData = sleepBarData.filter(d => !d.excluded);
  const maxSleep = Math.max(...includedSleepData.map(d => d.value), 1);
  const maxMilk = Math.max(...milkBarData.filter(d => !d.excluded).map(d => d.value), 1);
  const maxFormulaMl = Math.max(...formulaMlBarData.filter(d => !d.excluded).map(d => d.value), 1);
  const maxPee = Math.max(...peeBarData.filter(d => !d.excluded).map(d => d.value), 1);
  const maxPoop = Math.max(...poopBarData.filter(d => !d.excluded).map(d => d.value), 1);
  const maxBreast = Math.max(...breastBarData.filter(d => !d.excluded).map(d => d.value), 1);
  const maxExpress = Math.max(...expressBarData.filter(d => !d.excluded).map(d => d.value), 1);
  const maxStimulation = Math.max(...stimulationBarData.filter(d => !d.excluded).map(d => d.value), 1);

  const isNightHour = (h: number) => h >= 18 || h < 6;

  const nightSleepMins = useMemo(() =>
    heatmap.reduce((sum, v, h) => sum + (isNightHour(h) ? v : 0), 0)
  , [heatmap]);

  const daySleepMins = useMemo(() =>
    heatmap.reduce((sum, v, h) => sum + (!isNightHour(h) ? v : 0), 0)
  , [heatmap]);

  const heatmapDayCount = Math.max(1, 14 - excludedDates.length);
  const nightSleepAvgMins = Math.round(nightSleepMins / heatmapDayCount);
  const daySleepAvgMins = Math.round(daySleepMins / heatmapDayCount);

  const topNightHours = useMemo(() =>
    heatmap
      .map((v, h) => ({ hour: h, mins: v }))
      .filter(x => isNightHour(x.hour) && x.mins > 0)
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 3)
  , [heatmap]);

  const topDayHours = useMemo(() =>
    heatmap
      .map((v, h) => ({ hour: h, mins: v }))
      .filter(x => !isNightHour(x.hour) && x.mins > 0)
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 3)
  , [heatmap]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            data-testid="button-back"
            onClick={() => setLocation("/timeline")}
            className="p-2 rounded-xl bg-white border border-gray-100 shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-lg font-black text-gray-800">毎日の記録分析</h1>
            {activeChild && (
              <p className="text-xs text-gray-400 font-medium">{activeChild.name}ちゃん · 過去7日間</p>
            )}
          </div>
        </div>

        {/* 除外日管理パネル */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            data-testid="button-toggle-exclude-panel"
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowExcludePanel(v => !v)}
          >
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-black text-gray-700">分析から除外する日</span>
              {excludedDates.length > 0 && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                  {excludedDates.length}日除外中
                </span>
              )}
            </div>
            {showExcludePanel
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showExcludePanel && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
              <p className="text-[11px] text-gray-400 pt-2">
                祖父母に預けた日など記録が不完全だった日をタップして除外できます。除外した日はグラフ・アラーム予測に反映されません。
              </p>
              <div className="grid grid-cols-7 gap-1">
                {last14Days.map((date) => {
                  const dateStr = toDateStr(date);
                  const isExcluded = excludedDates.includes(dateStr);
                  const isToday = isSameDay(date, new Date());
                  return (
                    <button
                      key={dateStr}
                      data-testid={`button-exclude-date-${dateStr}`}
                      onClick={() => handleToggleDate(dateStr)}
                      className={`flex flex-col items-center py-1.5 px-0.5 rounded-xl border transition-all ${
                        isExcluded
                          ? "bg-red-50 border-red-200 text-red-500"
                          : isToday
                          ? "bg-purple-50 border-purple-200 text-purple-700"
                          : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      <span className="text-[9px] font-bold">
                        {format(date, "M/d")}
                      </span>
                      <span className="text-[9px] font-bold">
                        {format(date, "E", { locale: ja })}
                      </span>
                      {isExcluded && <X className="w-2.5 h-2.5 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
              {excludedDates.length > 0 && (
                <button
                  data-testid="button-clear-excluded-dates"
                  className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline"
                  onClick={() => {
                    setExcludedDates([]);
                    localStorage.setItem("we_iku_excluded_dates", "[]");
                  }}
                >
                  除外をすべてリセット
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "今日の睡眠",
              value: todayStat.excluded ? "除外中" : minutesToHM(todayStat.sleepMins),
              icon: <Moon className="w-4 h-4 text-indigo-500" />,
              delta: todayStat.excluded ? null : <SleepDeltaBadge current={todayStat.sleepMins} previous={yesterdayStat.sleepMins} />,
              sub: `昨日 ${yesterdayStat.excluded ? "—" : minutesToHM(yesterdayStat.sleepMins)}`,
              bg: "bg-indigo-50 border-indigo-100",
            },
            {
              label: "今日の授乳",
              value: todayStat.excluded ? "除外中" : `${todayStat.milkCount}回`,
              icon: <Milk className="w-4 h-4 text-blue-400" />,
              delta: todayStat.excluded ? null : <DeltaBadge current={todayStat.milkCount} previous={yesterdayStat.milkCount} />,
              sub: `昨日 ${yesterdayStat.excluded ? "—" : `${yesterdayStat.milkCount}回`}`,
              sub2: (!todayStat.excluded && todayStat.formulaTotalMl > 0) ? `ミルク計 ${todayStat.formulaTotalMl}ml` : null,
              bg: "bg-blue-50 border-blue-100",
            },
            {
              label: "おしっこ",
              value: todayStat.excluded ? "除外中" : `${todayStat.peeCount}回`,
              icon: <Droplets className="w-4 h-4 text-amber-400" />,
              delta: todayStat.excluded ? null : <DeltaBadge current={todayStat.peeCount} previous={yesterdayStat.peeCount} />,
              sub: `昨日 ${yesterdayStat.excluded ? "—" : `${yesterdayStat.peeCount}回`}`,
              bg: "bg-amber-50 border-amber-100",
            },
            {
              label: "うんち",
              value: todayStat.excluded ? "除外中" : `${todayStat.poopCount}回`,
              icon: <Droplets className="w-4 h-4 text-orange-400" />,
              delta: todayStat.excluded ? null : <DeltaBadge current={todayStat.poopCount} previous={yesterdayStat.poopCount} />,
              sub: `昨日 ${yesterdayStat.excluded ? "—" : `${yesterdayStat.poopCount}回`}`,
              bg: "bg-orange-50 border-orange-100",
            },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border p-3 ${item.bg} space-y-1`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">{item.icon}<span className="text-xs font-bold text-gray-500">{item.label}</span></div>
                {item.delta}
              </div>
              <p className={`text-2xl font-black ${todayStat.excluded ? "text-gray-300 text-base" : "text-gray-800"}`}>{item.value}</p>
              {(item as any).sub2 && (
                <p className="text-xs font-bold text-blue-500">{(item as any).sub2}</p>
              )}
              <p className="text-[10px] text-gray-400 font-medium">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            <h2 className="font-black text-sm text-gray-700">睡眠時間（7日間）</h2>
          </div>
          <BarChart data={sleepBarData} maxVal={maxSleep} color="bg-indigo-400" isTime />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            <h2 className="font-black text-sm text-gray-700">睡眠時間帯ヒートマップ（14日間）</h2>
          </div>
          <p className="text-[11px] text-gray-400">セルをタップすると時間が表示されます。色は夜間（紫）・昼間（緑）で分けています</p>
          {excludedDates.length > 0 && (
            <p className="text-[10px] font-bold text-purple-500">{excludedDates.length}日間除外済み</p>
          )}
          <HeatmapRow buckets={heatmap} />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Stars className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[11px] font-black text-indigo-600">夜間睡眠</span>
                <span className="text-[9px] text-indigo-400 font-medium">18〜6時</span>
              </div>
              <p className="text-lg font-black text-indigo-700">
                {nightSleepAvgMins > 0 ? minutesToHM(nightSleepAvgMins) : "—"}
                <span className="text-[10px] font-bold text-indigo-400 ml-1">/日</span>
              </p>
              {topNightHours.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {topNightHours.map((x, i) => (
                    <span key={x.hour} className="text-[10px] font-bold text-indigo-600 flex items-center justify-between">
                      <span>{i + 1}位 {x.hour}時台</span>
                      <span className="text-indigo-400">{minutesToHM(x.mins)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-indigo-300">データなし</p>
              )}
            </div>

            <div className="rounded-2xl bg-green-50 border border-green-100 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sunrise className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[11px] font-black text-green-700">昼寝</span>
                <span className="text-[9px] text-green-500 font-medium">6〜18時</span>
              </div>
              <p className="text-lg font-black text-green-700">
                {daySleepAvgMins > 0 ? minutesToHM(daySleepAvgMins) : "—"}
                <span className="text-[10px] font-bold text-green-500 ml-1">/日</span>
              </p>
              {topDayHours.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {topDayHours.map((x, i) => (
                    <span key={x.hour} className="text-[10px] font-bold text-green-700 flex items-center justify-between">
                      <span>{i + 1}位 {x.hour}時台</span>
                      <span className="text-green-500">{minutesToHM(x.mins)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-green-300">データなし</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Milk className="w-4 h-4 text-blue-400" />
            <h2 className="font-black text-sm text-gray-700">授乳回数（7日間）</h2>
          </div>
          <BarChart data={milkBarData} maxVal={maxMilk} color="bg-blue-300" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Milk className="w-4 h-4 text-sky-400" />
            <h2 className="font-black text-sm text-gray-700">ミルク量・ml（7日間）</h2>
          </div>
          <BarChart data={formulaMlBarData} maxVal={maxFormulaMl} color="bg-sky-300" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-amber-400" />
            <h2 className="font-black text-sm text-gray-700">おしっこ回数（7日間）</h2>
          </div>
          <BarChart data={peeBarData} maxVal={maxPee} color="bg-amber-300" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-orange-400" />
            <h2 className="font-black text-sm text-gray-700">うんち回数（7日間）</h2>
          </div>
          <BarChart data={poopBarData} maxVal={maxPoop} color="bg-orange-300" />
        </div>

        {/* 母乳量サポート分析（トグル） */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            data-testid="button-toggle-stimulation-panel"
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowStimulationPanel(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-teal-500" />
              <span className="text-sm font-black text-gray-700">母乳量サポート分析</span>
              <span className="text-[10px] font-bold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">
                今日 {todayStat.excluded ? "—" : `${todayStat.stimulationCount}回`}
              </span>
            </div>
            {showStimulationPanel
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showStimulationPanel && (
            <div className="px-4 pb-5 space-y-4 border-t border-gray-50">
              <p className="text-[11px] text-gray-400 pt-3">
                直接授乳（母乳・混合）と搾乳を合わせた乳頭刺激の回数です。回数が多いほど母乳分泌を促す効果が期待できます。
              </p>

              {/* 今日のサマリーカード */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "直接授乳",
                    value: todayStat.excluded ? "—" : `${todayStat.breastCount}回`,
                    icon: <Milk className="w-4 h-4 text-blue-400" />,
                    bg: "bg-blue-50 border-blue-100",
                    sub: `昨日 ${yesterdayStat.excluded ? "—" : `${yesterdayStat.breastCount}回`}`,
                    textColor: "text-blue-700",
                  },
                  {
                    label: "搾乳",
                    value: todayStat.excluded ? "—" : `${todayStat.expressCount}回`,
                    icon: <Timer className="w-4 h-4 text-teal-500" />,
                    bg: "bg-teal-50 border-teal-100",
                    sub: `昨日 ${yesterdayStat.excluded ? "—" : `${yesterdayStat.expressCount}回`}`,
                    textColor: "text-teal-700",
                  },
                  {
                    label: "合計刺激",
                    value: todayStat.excluded ? "—" : `${todayStat.stimulationCount}回`,
                    icon: <Zap className="w-4 h-4 text-purple-500" />,
                    bg: "bg-purple-50 border-purple-100",
                    sub: `昨日 ${yesterdayStat.excluded ? "—" : `${yesterdayStat.stimulationCount}回`}`,
                    textColor: "text-purple-700",
                  },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl border p-3 ${item.bg} space-y-1`}>
                    <div className="flex items-center gap-1">
                      {item.icon}
                      <span className="text-[10px] font-bold text-gray-500">{item.label}</span>
                    </div>
                    <p className={`text-xl font-black ${todayStat.excluded ? "text-gray-300 text-sm" : item.textColor}`}>{item.value}</p>
                    <p className="text-[9px] text-gray-400 font-medium">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* 直接授乳グラフ */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Milk className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-black text-gray-600">直接授乳回数（7日間）</span>
                </div>
                <BarChart data={breastBarData} maxVal={maxBreast} color="bg-blue-300" />
              </div>

              {/* 搾乳グラフ */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-teal-500" />
                  <span className="text-xs font-black text-gray-600">搾乳回数（7日間）</span>
                </div>
                <BarChart data={expressBarData} maxVal={maxExpress} color="bg-teal-300" />
              </div>

              {/* 合計刺激回数グラフ */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-black text-gray-600">合計刺激回数（7日間）</span>
                </div>
                <BarChart data={stimulationBarData} maxVal={maxStimulation} color="bg-purple-300" />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="font-black text-sm text-gray-700">1週間前と比較</h2>
          <div className="space-y-2">
            {[
              { label: "睡眠時間", cur: todayStat.excluded ? "—" : minutesToHM(todayStat.sleepMins), prev: weekAgoStat.excluded ? "—" : minutesToHM(weekAgoStat.sleepMins), delta: (todayStat.excluded || weekAgoStat.excluded) ? null : <SleepDeltaBadge current={todayStat.sleepMins} previous={weekAgoStat.sleepMins} />, icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
              { label: "授乳", cur: todayStat.excluded ? "—" : `${todayStat.milkCount}回`, prev: weekAgoStat.excluded ? "—" : `${weekAgoStat.milkCount}回`, delta: (todayStat.excluded || weekAgoStat.excluded) ? null : <DeltaBadge current={todayStat.milkCount} previous={weekAgoStat.milkCount} />, icon: <Milk className="w-3.5 h-3.5 text-blue-400" /> },
              { label: "ミルク量", cur: todayStat.excluded ? "—" : `${todayStat.formulaTotalMl}ml`, prev: weekAgoStat.excluded ? "—" : `${weekAgoStat.formulaTotalMl}ml`, delta: (todayStat.excluded || weekAgoStat.excluded) ? null : <DeltaBadge current={todayStat.formulaTotalMl} previous={weekAgoStat.formulaTotalMl} />, icon: <Milk className="w-3.5 h-3.5 text-sky-400" /> },
              { label: "おしっこ", cur: todayStat.excluded ? "—" : `${todayStat.peeCount}回`, prev: weekAgoStat.excluded ? "—" : `${weekAgoStat.peeCount}回`, delta: (todayStat.excluded || weekAgoStat.excluded) ? null : <DeltaBadge current={todayStat.peeCount} previous={weekAgoStat.peeCount} />, icon: <Droplets className="w-3.5 h-3.5 text-amber-400" /> },
              { label: "うんち", cur: todayStat.excluded ? "—" : `${todayStat.poopCount}回`, prev: weekAgoStat.excluded ? "—" : `${weekAgoStat.poopCount}回`, delta: (todayStat.excluded || weekAgoStat.excluded) ? null : <DeltaBadge current={todayStat.poopCount} previous={weekAgoStat.poopCount} />, icon: <Droplets className="w-3.5 h-3.5 text-orange-400" /> },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                {row.icon}
                <span className="text-xs font-bold text-gray-600 w-16">{row.label}</span>
                <span className="text-xs font-black text-gray-800 flex-1">{row.cur}</span>
                <span className="text-[11px] text-gray-400 font-medium">7日前 {row.prev}</span>
                {row.delta}
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
