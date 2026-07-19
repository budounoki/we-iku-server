import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useLogs, useSettings } from "@/hooks/use-app-data";
import { useUserLabels } from "@/hooks/use-user-labels";
import { useActiveChild } from "@/hooks/use-active-child";
import { format, parseISO, subMonths, addMonths } from "date-fns";
import { ja } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Apple, Star, Award, Gamepad2,
  MessageCircle, Palette, Utensils, Cookie, ArrowLeft, UtensilsCrossed,
  BookOpen, Building2, GraduationCap, ThumbsUp, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateMemoriesPdf } from "@/lib/memories-pdf";
import { cn } from "@/lib/utils";

type TabType = "all" | "food" | "milestone" | "school";

const FOOD_TYPES = new Set(["food", "meal", "snack"]);
const MILESTONE_TYPES = new Set(["milestone", "achievement", "words", "hobby", "play"]);
const SCHOOL_TYPES = new Set(["school_report", "school_prep", "discipline", "schedule"]);

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  food: { label: "離乳食", icon: Apple, color: "text-orange-500", bg: "bg-orange-50" },
  meal: { label: "ごはん", icon: Utensils, color: "text-amber-600", bg: "bg-amber-50" },
  snack: { label: "おやつ", icon: Cookie, color: "text-yellow-500", bg: "bg-yellow-50" },
  milestone: { label: "はじめて", icon: Star, color: "text-purple-500", bg: "bg-purple-50" },
  achievement: { label: "できた!", icon: Award, color: "text-emerald-600", bg: "bg-emerald-50" },
  words: { label: "ことば", icon: MessageCircle, color: "text-green-600", bg: "bg-green-50" },
  hobby: { label: "きょうみ", icon: Palette, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  play: { label: "あそび", icon: Gamepad2, color: "text-lime-600", bg: "bg-lime-50" },
  school_report: { label: "園の記録", icon: Building2, color: "text-sky-600", bg: "bg-sky-50" },
  school_prep: { label: "入学準備", icon: GraduationCap, color: "text-violet-600", bg: "bg-violet-50" },
  discipline: { label: "しつけ", icon: ThumbsUp, color: "text-yellow-600", bg: "bg-yellow-50" },
  schedule: { label: "よてい", icon: CalendarDays, color: "text-blue-500", bg: "bg-blue-50" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { label: type, icon: UtensilsCrossed, color: "text-gray-400", bg: "bg-gray-50" };
}

function cleanMessage(type: string, message: string | null): string | null {
  if (!message) return null;
  if (type === "school_report" && message.startsWith("園の記録: ")) return message.slice(6);
  if (type === "discipline" && message.startsWith("しつけ: ")) return message.slice(5);
  if (type === "schedule" && message.startsWith("よてい: ")) return message.slice(5);
  if (type === "words" && message.startsWith("ことば: ")) return message.slice(5);
  return message;
}

const FOOD_AMOUNT_LABELS: Record<string, string> = {
  "大さじ1": "大さじ1",
  "大さじ2": "大さじ2",
  "大さじ3": "大さじ3",
  "半分くらい": "半分くらい",
  "全部": "全部",
};

const TABS: [TabType, string][] = [
  ["all", "全部"],
  ["food", "食事"],
  ["milestone", "成長"],
  ["school", "園・予定"],
];

export default function LogReview() {
  const [, setLocation] = useLocation();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: allLogs = [] } = useLogs(familyId);
  const { data: settings } = useSettings(familyId);
  const { activeChild, activeChildId } = useActiveChild(familyId, settings);
  const [tab, setTab] = useState<TabType>("all");
  const [month, setMonth] = useState(() => new Date());
  const [exporting, setExporting] = useState(false);
  const { getLabel } = useUserLabels();

  const childName = activeChild?.name || settings?.babyName || "お子さま";
  const birthday = activeChild?.birthday || settings?.babyBirthday || null;

  const handleExportMemories = () => {
    if (exporting) return;
    setExporting(true);
    try {
      generateMemoriesPdf({ childName, birthday, allLogs: allLogs as any[], familyId });
    } finally {
      setTimeout(() => setExporting(false), 2000);
    }
  };

  const childLogs = useMemo(() => {
    if (!activeChildId) return allLogs;
    return (allLogs as any[]).filter((l: any) => l.childId === activeChildId || !l.childId);
  }, [allLogs, activeChildId]);

  const filtered = useMemo(() => {
    const monthStr = format(month, "yyyy-MM");
    return (childLogs as any[]).filter((log: any) => {
      const logMonth = (log.createdAt as string)?.slice(0, 7);
      if (logMonth !== monthStr) return false;
      if (tab === "food") return FOOD_TYPES.has(log.type);
      if (tab === "milestone") return MILESTONE_TYPES.has(log.type);
      if (tab === "school") return SCHOOL_TYPES.has(log.type);
      return FOOD_TYPES.has(log.type) || MILESTONE_TYPES.has(log.type) || SCHOOL_TYPES.has(log.type);
    });
  }, [childLogs, tab, month]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach((log: any) => {
      const d = (log.createdAt as string)?.slice(0, 10) || "";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(log);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const schoolCount = useMemo(() => {
    const monthStr = format(month, "yyyy-MM");
    return (childLogs as any[]).filter((l: any) =>
      (l.createdAt as string)?.slice(0, 7) === monthStr && SCHOOL_TYPES.has(l.type)
    ).length;
  }, [childLogs, month]);

  const now = new Date();
  const isCurrentMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/timeline")}
            className="rounded-2xl shrink-0"
            data-testid="button-back-log-review"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-black text-gray-800">振り返り</h1>
            {settings?.babyName && (
              <p className="text-xs text-gray-400 font-bold">{settings.babyName}の食事・成長・園の記録</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportMemories}
            disabled={exporting}
            className="rounded-xl text-purple-600 hover:bg-purple-50 gap-1.5 px-3 shrink-0"
            data-testid="button-export-memories-pdf"
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold">{exporting ? "作成中..." : "思い出PDF"}</span>
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(m => subMonths(m, 1))}
            className="rounded-xl h-8 w-8"
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-black text-gray-800">
            {format(month, "yyyy年M月", { locale: ja })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(m => addMonths(m, 1))}
            className="rounded-xl h-8 w-8"
            disabled={isCurrentMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              data-testid={`tab-review-${id}`}
              className={cn(
                "py-2 rounded-2xl text-[11px] font-black border-2 transition-all relative",
                tab === id
                  ? "bg-purple-500 border-purple-500 text-white shadow-sm"
                  : "bg-white border-gray-100 text-gray-500"
              )}
            >
              {label}
              {id === "school" && schoolCount > 0 && tab !== "school" && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {schoolCount > 9 ? "9+" : schoolCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "school" && (
          <div className="flex items-start gap-2 bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3">
            <Building2 className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-sky-700 font-bold leading-relaxed">
              園の記録・入学準備・よてい・しつけなど、園や学校に関連した記録をまとめて確認できます。
            </p>
          </div>
        )}

        {grouped.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-bold text-gray-400">この月の記録はありません</p>
            {tab === "school" && (
              <p className="text-xs text-gray-300 mt-1">「きろく」から園の記録を追加できます</p>
            )}
          </div>
        ) : (
          grouped.map(([dateStr, logs]) => {
            const date = parseISO(dateStr);
            return (
              <div key={dateStr} className="space-y-2">
                <p className="text-xs font-black text-gray-400 px-1 pt-1">
                  {format(date, "M月d日（E）", { locale: ja })}
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                  {(logs as any[]).map((log: any) => {
                    const cfg = getTypeConfig(log.type);
                    const Icon = cfg.icon;
                    const isFoodType = FOOD_TYPES.has(log.type);
                    const performer = log.performedBy || log.userId;
                    const performerLabel = performer === "papa" || performer === "mama" ? getLabel(performer) : null;
                    const displayMessage = cleanMessage(log.type, log.message);

                    return (
                      <div
                        key={log.id}
                        className="px-4 py-3 flex items-start gap-3"
                        data-testid={`review-item-${log.id}`}
                      >
                        <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", cfg.bg)}>
                          <Icon className={cn("w-4 h-4", cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-[11px] font-black text-gray-400">{cfg.label}</span>
                            <span className="text-[10px] font-bold text-gray-300">
                              {format(new Date(log.createdAt), "HH:mm")}
                            </span>
                          </div>
                          {isFoodType ? (
                            <>
                              {log.foodItems ? (() => {
                                let entries: { name: string; amount: string }[] | null = null;
                                try { const p = JSON.parse(log.foodItems); if (Array.isArray(p)) entries = p; } catch {}
                                const amountBadge = (a: string) =>
                                  a === "完食" ? "bg-green-100 text-green-700" :
                                  a === "半分" ? "bg-amber-100 text-amber-700" :
                                  a === "ひと口" ? "bg-sky-100 text-sky-700" :
                                  a === "拒否" ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600";
                                return entries ? (
                                  <div className="space-y-0.5 mt-0.5">
                                    {entries.map((e, i) => (
                                      <div key={i} className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-gray-800 truncate">{e.name || "（食材）"}</span>
                                        {e.amount && (
                                          <span className={`shrink-0 text-[11px] font-black px-1.5 py-0.5 rounded-full ${amountBadge(e.amount)}`}>{e.amount}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm font-bold text-gray-800 break-words">{log.foodItems}</p>
                                );
                              })() : displayMessage ? (
                                <p className="text-sm font-bold text-gray-700 break-words">{displayMessage}</p>
                              ) : null}
                              {log.foodAmount && (() => {
                                let isNew = false;
                                try { const p = JSON.parse(log.foodItems ?? ""); if (Array.isArray(p)) isNew = true; } catch {}
                                return isNew ? null : (
                                  <p className="text-xs text-gray-500 mt-0.5">{FOOD_AMOUNT_LABELS[log.foodAmount] || log.foodAmount}</p>
                                );
                              })()}
                              {log.foodNote && (
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed border-t border-gray-100 pt-1">{log.foodNote}</p>
                              )}
                            </>
                          ) : (
                            displayMessage && (
                              <p className="text-sm font-bold text-gray-800 break-words">{displayMessage}</p>
                            )
                          )}
                          {performerLabel && (
                            <span className={cn(
                              "inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                              performer === "papa" ? "bg-blue-50 text-blue-500" : "bg-pink-50 text-pink-500"
                            )}>
                              {performerLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
