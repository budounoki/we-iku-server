import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/Navigation";
import { QuickActions } from "@/components/ActionButtons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLogs, useSleepSessions, useSettings, useDeleteLog, useDeleteSleepSession, useManualSleepSession, useStartSleepSession, useActiveSleepSession } from "@/hooks/use-app-data";
import { useUserLabels } from "@/hooks/use-user-labels";
import { useActiveChild } from "@/hooks/use-active-child";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format, startOfDay, differenceInMinutes, isSameDay, isBefore, subDays, addDays, setHours, setMinutes,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  Moon, Droplets, Baby, Milk, Apple, Star, Thermometer,
  UtensilsCrossed, MessageCircle, ThumbsUp, School, Pill,
  Palette, Award, GraduationCap, TrendingUp, Heart, Stethoscope, Bath, Gamepad2, Sparkles,
  ChevronLeft, ChevronRight, ChevronDown, GripVertical, Clock, Loader2, Plus, Trash2, Pencil, CalendarDays,
  Scissors, Droplet, ClipboardList, Sun, GlassWater, FileDown,
} from "lucide-react";
import { generateTimelinePdf } from "@/lib/pdf-export";
import { ScrollDateTimePicker } from "@/components/ScrollWheelPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 80;
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const LOG_ENTRY_HEIGHT = 32;

const LOG_TYPES_TO_SHOW = [
  "milk", "diaper", "food", "meal", "snack", "drink", "toilet", "bath",
  "temp", "symptom", "medicine", "toothbrush", "temperature", "play",
  "milestone", "words", "discipline", "school_report", "hobby",
  "achievement", "schedule", "school_prep", "growth_note",
  "nail_care", "skincare", "clinic", "thanks", "hold", "custom",
];

function getLogIcon(type: string, subType?: string, bodyTemperature?: number | null) {
  switch (type) {
    case "milk":
      if (subType === "breast") return { Icon: Baby, color: "text-pink-500", bg: "bg-pink-50", border: "border-pink-200", label: "母乳" };
      if (subType === "formula") return { Icon: Milk, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200", label: "ミルク" };
      return { Icon: Milk, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200", label: "ミルク" };
    case "diaper":
      return { Icon: Droplets, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "おむつ" };
    case "food":
      return { Icon: Apple, color: "text-green-500", bg: "bg-green-50", border: "border-green-200", label: "離乳食" };
    case "milestone":
      return { Icon: Star, color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200", label: "はじめて" };
    case "temp":
      return { Icon: Thermometer, color: "text-red-500", bg: "bg-red-50", border: "border-red-200", label: "体温" };
    case "temperature": {
      const t = typeof bodyTemperature === "number" ? bodyTemperature : 36.5;
      if (t >= 38.5) return { Icon: Thermometer, color: "text-red-500", bg: "bg-red-50", border: "border-red-200", label: "体温" };
      if (t >= 37.5) return { Icon: Thermometer, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "体温" };
      return { Icon: Thermometer, color: "text-green-500", bg: "bg-green-50", border: "border-green-200", label: "体温" };
    }
    case "symptom":
      return { Icon: Stethoscope, color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-200", label: "症状メモ" };
    case "thanks":
      return { Icon: Heart, color: "text-red-500", bg: "bg-red-50", border: "border-red-200", label: "ありがとう" };
    case "toilet":
      return { Icon: Droplets, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", label: "トイレ" };
    case "meal":
      return { Icon: UtensilsCrossed, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", label: "ごはん" };
    case "words":
      return { Icon: MessageCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "ことば" };
    case "discipline":
      return { Icon: ThumbsUp, color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", label: "しつけ" };
    case "school_report":
      return { Icon: School, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200", label: "園の記録" };
    case "medicine":
      return { Icon: Pill, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", label: "おくすり" };
    case "hobby":
      return { Icon: Palette, color: "text-fuchsia-600", bg: "bg-fuchsia-50", border: "border-fuchsia-200", label: "きょうみ" };
    case "achievement":
      return { Icon: Award, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "できた!" };
    case "school_prep":
      return { Icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: "入学準備" };
    case "growth_note":
      return { Icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", label: "成長メモ" };
    case "snack":
      return { Icon: Apple, color: "text-pink-500", bg: "bg-pink-50", border: "border-pink-200", label: "おやつ" };
    case "drink":
      return { Icon: GlassWater, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", label: subType || "のみもの" };
    case "bath":
      return { Icon: Bath, color: "text-sky-500", bg: "bg-sky-50", border: "border-sky-200", label: "おふろ" };
    case "hold":
      return { Icon: Heart, color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-200", label: "抱っこ" };
    case "toothbrush":
      return { Icon: Sparkles, color: "text-cyan-500", bg: "bg-cyan-50", border: "border-cyan-200", label: "はみがき" };
    case "clinic":
      return { Icon: Stethoscope, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", label: "通院" };
    case "nail_care":
      return { Icon: Scissors, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200", label: "爪切り" };
    case "skincare":
      return { Icon: Droplet, color: "text-blue-400", bg: "bg-blue-50", border: "border-blue-200", label: "保湿" };
    case "schedule":
      return { Icon: CalendarDays, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", label: "よてい" };
    case "play":
      return { Icon: Gamepad2, color: "text-lime-600", bg: "bg-lime-50", border: "border-lime-200", label: "あそび" };
    case "custom":
      return { Icon: Star, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", label: subType || "カスタム" };
    default:
      return { Icon: Star, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", label: type };
  }
}

function getLogDetail(log: any) {
  if (log.type === "milk") {
    if (log.subType === "breast") {
      const parts = [];
      if (log.breastLeftMin) parts.push(`左${log.breastLeftMin}分`);
      if (log.breastRightMin) parts.push(`右${log.breastRightMin}分`);
      const timeStr = parts.length > 0 ? `母乳 ${parts.join(" ")}` : "母乳";
      if (log.expressedMl) return `${timeStr} / 搾乳${log.expressedMl}ml`;
      return timeStr;
    }
    if (log.subType === "formula") return log.formulaMl ? `粉ミルク ${log.formulaMl}ml` : "粉ミルク";
    if (log.subType === "expressed") return log.expressedMl ? `搾乳母乳 ${log.expressedMl}ml` : "搾乳母乳";
    if (log.subType === "express") {
      const parts = [];
      if (log.breastLeftMin) parts.push(`${log.breastLeftMin}分`);
      if (log.expressedMl) parts.push(`${log.expressedMl}ml`);
      return parts.length > 0 ? `搾乳 ${parts.join(" ")}` : "搾乳";
    }
    if (log.subType === "mixed") {
      const parts = [];
      if (log.breastLeftMin || log.breastRightMin) {
        const bp = [];
        if (log.breastLeftMin) bp.push(`左${log.breastLeftMin}分`);
        if (log.breastRightMin) bp.push(`右${log.breastRightMin}分`);
        parts.push(`母乳${bp.join("")}`);
      }
      if (log.expressedMl) parts.push(`搾乳${log.expressedMl}ml`);
      if (log.formulaMl) parts.push(`粉ミルク${log.formulaMl}ml`);
      return parts.length > 0 ? parts.join(" + ") : "混合";
    }
    if (log.formulaMl) return `粉ミルク ${log.formulaMl}ml`;
    return "";
  }
  if (log.type === "diaper") {
    if (log.subType === "other") return "その他";
    const base = log.subType === "pee" ? "おしっこ" : log.subType === "poop" ? "うんち" : "おしっこ＋うんち";
    if (log.subType === "pee") return base;
    const details: string[] = [];
    if (log.poopColor) {
      const colorMap: Record<string, string> = { yellow: "黄", green: "緑", brown: "茶", black: "黒", white: "白", red: "赤" };
      details.push(colorMap[log.poopColor] || log.poopColor);
    }
    if (log.poopConsistency) {
      const cMap: Record<string, string> = { normal: "普通", hard: "硬い", soft: "軟らかい", watery: "水っぽい" };
      details.push(cMap[log.poopConsistency] || log.poopConsistency);
    }
    if (log.stoolAmount) {
      const aMap: Record<string, string> = { small: "少量", medium: "普通", large: "多い" };
      details.push(aMap[log.stoolAmount] || log.stoolAmount);
    }
    return details.length > 0 ? `${base} (${details.join("・")})` : base;
  }
  if (log.type === "medicine") {
    const parts: string[] = [];
    if (log.medicineName) parts.push(log.medicineName);
    if (log.medicineDose) parts.push(log.medicineDose);
    return parts.length > 0 ? parts.join(" ") : "";
  }
  if (log.type === "temp" && log.bodyTemperature) return `${log.bodyTemperature}°C`;
  if (log.type === "temperature" && log.bodyTemperature != null) return `${Number(log.bodyTemperature).toFixed(1)}°C`;
  if (log.type === "toilet") return log.subType === "success" ? "トイレ成功" : log.subType === "fail" ? "トイレ失敗" : log.subType === "invited" ? "トイレ誘い" : "トイレ";
  return "";
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function formatUser(userId: string): string {
  if (userId === "papa") return localStorage.getItem("we_iku_papa_label") || "パパ";
  if (userId === "mama") return localStorage.getItem("we_iku_mama_label") || "ママ";
  if (userId === "other") return "その他";
  return userId;
}

function minutesToTimeStr(totalMin: number): string {
  const clamped = Math.max(0, Math.min(totalMin, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = Math.floor(clamped % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function topPxToMinutes(topPx: number): number {
  return (topPx / TOTAL_HEIGHT) * 24 * 60;
}

function minutesToTopPx(minutes: number): number {
  return (minutes / (24 * 60)) * TOTAL_HEIGHT;
}

export default function Timeline() {
  const [, setLocation] = useLocation();
  const { papaLabel, mamaLabel } = useUserLabels();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: allLogs } = useLogs(familyId);
  const { data: allSleepSessions = [] } = useSleepSessions(familyId);
  const { data: settings } = useSettings(familyId);
  const { activeChild } = useActiveChild(familyId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draggingLogId, setDraggingLogId] = useState<number | null>(null);
  const [dragCenterPx, setDragCenterPx] = useState<number | null>(null);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [logEditMode, setLogEditMode] = useState(false);
  const [confirmingDeleteLog, setConfirmingDeleteLog] = useState<any>(null);
  const [confirmingDeleteSleep, setConfirmingDeleteSleep] = useState<any>(null);
  const [sleepEditMode, setSleepEditMode] = useState(false);
  const [editTime, setEditTime] = useState("");
  const [editFormulaMl, setEditFormulaMl] = useState("");
  const [editBreastLeftMin, setEditBreastLeftMin] = useState("");
  const [editBreastRightMin, setEditBreastRightMin] = useState("");
  const [editExpressedMl, setEditExpressedMl] = useState("");
  const [editSpitUp, setEditSpitUp] = useState(false);
  const [editSpitUpAmount, setEditSpitUpAmount] = useState("");
  const [editSpitUpTiming, setEditSpitUpTiming] = useState("");
  const [editSpitUpNote, setEditSpitUpNote] = useState("");
  const [editPerformers, setEditPerformers] = useState<string[]>([]);
  const [editFoodNote, setEditFoodNote] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editBreastExpressed, setEditBreastExpressed] = useState(false);
  const deleteLog = useDeleteLog();

  const MESSAGE_PREFIX_MAP: Record<string, string> = {
    school_report: "園の記録: ",
    school_prep: "入学準備: ",
  };
  const deleteSleepSession = useDeleteSleepSession();
  const openLogEditor = (log: any) => {
    setEditingLog(log);
    setLogEditMode(false);
    setEditTime(format(new Date(log.createdAt), "yyyy-MM-dd'T'HH:mm"));
    const rawPerformer = log.performedBy || log.userId || "";
    setEditPerformers(rawPerformer ? rawPerformer.split("・").filter(Boolean) : []);
    if (log.type === "milk") {
      setEditFormulaMl(log.formulaMl != null ? String(log.formulaMl) : "");
      setEditBreastLeftMin(log.breastLeftMin != null ? String(log.breastLeftMin) : "");
      setEditBreastRightMin(log.breastRightMin != null ? String(log.breastRightMin) : "");
      setEditExpressedMl(log.expressedMl != null ? String(log.expressedMl) : "");
      setEditBreastExpressed(log.subType === "breast" && log.expressedMl != null && log.expressedMl > 0);
      setEditSpitUp(!!log.spitUp);
      setEditSpitUpAmount(log.spitUpAmount ?? "");
      setEditSpitUpTiming(log.spitUpTiming ?? "");
      setEditSpitUpNote(log.spitUpNote ?? "");
    }
    if (log.type === "food") {
      setEditFoodNote(log.foodNote ?? "");
    } else if (log.type === "meal") {
      let isMemo = true;
      try { if (Array.isArray(JSON.parse(log.foodItems ?? ""))) isMemo = false; } catch {}
      setEditFoodNote(isMemo ? (log.foodItems ?? "") : "");
    } else {
      setEditFoodNote("");
    }
    const prefix = MESSAGE_PREFIX_MAP[log.type as string];
    if (prefix && typeof log.message === "string") {
      setEditMemo(log.message.startsWith(prefix) ? log.message.slice(prefix.length) : log.message);
    } else {
      setEditMemo("");
    }
  };
  const [editingSleep, setEditingSleep] = useState<any>(null);
  const [editingSleepLogId, setEditingSleepLogId] = useState<number | null>(null);
  const [editSleepStart, setEditSleepStart] = useState("");
  const [editSleepEnd, setEditSleepEnd] = useState("");
  const [editWakingMinutes, setEditWakingMinutes] = useState(0);

  const [draggingSleepId, setDraggingSleepId] = useState<number | null>(null);
  const [sleepDragTopPx, setSleepDragTopPx] = useState<number | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addLogType, setAddLogType] = useState("");
  const [addLogTime, setAddLogTime] = useState("");
  const [addLogSubType, setAddLogSubType] = useState("");
  const [addLogMemo, setAddLogMemo] = useState("");
  const [addLogFormulaMl, setAddLogFormulaMl] = useState("");
  const [addLogSaving, setAddLogSaving] = useState(false);

  // Manual sleep entry dialog
  const [showManualSleepDialog, setShowManualSleepDialog] = useState(false);
  const [tlManualStartTime, setTlManualStartTime] = useState("");
  const [tlManualEndTime, setTlManualEndTime] = useState("");
  const [tlManualNoEnd, setTlManualNoEnd] = useState(false);
  const [tlManualSleepError, setTlManualSleepError] = useState("");
  const [tlSettlingMethod, setTlSettlingMethod] = useState<string[]>([]);
  const [tlSleepLocation, setTlSleepLocation] = useState("");
  const [tlSleepNote, setTlSleepNote] = useState("");
  const manualSleep = useManualSleepSession();
  const startSleep = useStartSleepSession();
  const { activeChild: activeChildForSleep } = useActiveChild(familyId, settings);
  const activeChildIdForSleep = activeChildForSleep?.id ?? null;
  const { data: activeSession } = useActiveSleepSession(familyId, activeChildIdForSleep);

  const openManualSleepDialog = () => {
    const now = new Date();
    now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setTlManualStartTime(format(oneHourAgo, "yyyy-MM-dd'T'HH:mm"));
    setTlManualEndTime(format(now, "yyyy-MM-dd'T'HH:mm"));
    setTlManualSleepError("");
    setTlManualNoEnd(false);
    setTlSettlingMethod([]);
    setTlSleepLocation("");
    setTlSleepNote("");
    setShowManualSleepDialog(true);
  };

  const dragRef = useRef<{
    logId: number;
    startTouchY: number;
    centerPxAtStart: number;
    hasMoved: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    activated: boolean;
  } | null>(null);

  const sleepDragRef = useRef<{
    sessionId: number;
    startTouchY: number;
    topPxAtStart: number;
    heightPx: number;
    hasMoved: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    activated: boolean;
    session: any;
  } | null>(null);

  const updateLogTime = useMutation({
    mutationFn: async ({ id, createdAt }: { id: number; createdAt: string }) => {
      const res = await fetch(`/api/logs/${id}/update-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdAt }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs/:familyId"] });
      toast({ title: "時間を変更しました" });
    },
  });

  const updateLog = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: any }) => {
      const res = await fetch(`/api/logs/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs/:familyId"] });
      toast({ title: "記録を更新しました" });
    },
  });

  const updateSleepTime = useMutation({
    mutationFn: async ({ id, startedAt, endedAt, wakingMinutes }: { id: number; startedAt: string; endedAt?: string; wakingMinutes?: number }) => {
      const res = await fetch(`/api/sleep-sessions/${id}/update-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt, endedAt, wakingMinutes: wakingMinutes ?? 0 }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sleep-sessions/:familyId"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sleep-sessions/:familyId/active"] });
      toast({ title: "ねんねの時間を変更しました" });
    },
  });

  const activeChildId = activeChild?.id ?? null;
  const childName = activeChild?.name || settings?.babyName || "赤ちゃん";
  const logs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);
  const sleepSessions = useMemo(() => {
    if (!activeChildId) return allSleepSessions;
    return allSleepSessions.filter((s: any) => !s.childId || s.childId === activeChildId);
  }, [allSleepSessions, activeChildId]);

  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);
  const dateChipsRef = useRef<HTMLDivElement>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeLocked = useRef<"h" | "v" | null>(null);

  const dateChips = useMemo(() => {
    const chips = [];
    const windowEnd = isBefore(selectedDate, subDays(today, 6)) ? addDays(selectedDate, 6) : today;
    for (let i = 6; i >= 0; i--) {
      chips.push(subDays(windowEnd, i));
    }
    return chips;
  }, [today.getTime(), selectedDate]);

  const isSelectedToday = isSameDay(selectedDate, today);

  const dayLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l: any) => {
      const created = new Date(l.createdAt);
      return isSameDay(created, selectedDate) && LOG_TYPES_TO_SHOW.includes(l.type);
    });
  }, [logs, selectedDate]);

  const daySleepSessions = useMemo(() => {
    if (!sleepSessions) return [];
    return sleepSessions.filter((s: any) => {
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : new Date();
      return isSameDay(start, selectedDate) || isSameDay(end, selectedDate);
    });
  }, [sleepSessions, selectedDate]);

  const daySleepTotalMinutes = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    let total = 0;
    for (const s of daySleepSessions as any[]) {
      if (!s.endedAt) continue;
      const start = new Date(s.startedAt);
      const end = new Date(s.endedAt);
      const effectiveStart = start < dayStart ? dayStart : start;
      const effectiveEnd = end > dayEnd ? dayEnd : end;
      if (effectiveEnd > effectiveStart) {
        total += differenceInMinutes(effectiveEnd, effectiveStart);
      }
    }
    return total;
  }, [daySleepSessions, selectedDate]);

  const logLayoutMap = useMemo(() => {
    const map = new Map<number, { top: number; col: number; totalCols: number }>();
    const sorted = [...dayLogs].sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const groups: any[][] = [];
    for (const log of sorted) {
      const created = new Date(log.createdAt);
      const min = minutesFromMidnight(created);
      const top = minutesToTopPx(min) - LOG_ENTRY_HEIGHT / 2;
      let placed = false;
      for (const group of groups) {
        const groupTop = minutesToTopPx(minutesFromMidnight(new Date(group[0].createdAt))) - LOG_ENTRY_HEIGHT / 2;
        if (Math.abs(top - groupTop) < LOG_ENTRY_HEIGHT + 4) {
          group.push(log);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([log]);
    }
    for (const group of groups) {
      const firstCreated = new Date(group[0].createdAt);
      const groupTop = minutesToTopPx(minutesFromMidnight(firstCreated)) - LOG_ENTRY_HEIGHT / 2;
      const totalCols = group.length;
      group.forEach((log: any, idx: number) => {
        map.set(log.id, { top: groupTop, col: idx, totalCols });
      });
    }
    return map;
  }, [dayLogs]);

  useEffect(() => {
    if (!isSelectedToday) return;
    const timer = setTimeout(() => {
      if (currentLineRef.current && scrollRef.current) {
        const lineTop = currentLineRef.current.offsetTop;
        const containerHeight = scrollRef.current.clientHeight;
        scrollRef.current.scrollTop = lineTop - containerHeight / 2;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isSelectedToday]);

  useEffect(() => {
    if (dateChipsRef.current) {
      dateChipsRef.current.scrollLeft = dateChipsRef.current.scrollWidth;
    }
  }, []);

  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!swipeStart.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - swipeStart.current.x;
      const dy = e.touches[0].clientY - swipeStart.current.y;
      if (!swipeLocked.current) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        }
      }
      if (swipeLocked.current === "h") {
        e.preventDefault();
        setSwipeOffset(dx);
      }
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const nowMinutes = minutesFromMidnight(new Date());
  const nowTop = minutesToTopPx(nowMinutes);

  const canGoBack = true;
  const canGoForward = !isSameDay(selectedDate, today);

  const navigateDate = (direction: "back" | "forward") => {
    if (direction === "back") {
      setSelectedDate(prev => subDays(prev, 1));
    }
    if (direction === "forward" && canGoForward) {
      setSelectedDate(prev => addDays(prev, 1));
    }
  };

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    swipeLocked.current = null;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStart.current) return;
    const dx = e.changedTouches[0].clientX - swipeStart.current.x;
    const elapsed = Date.now() - swipeStart.current.t;
    swipeStart.current = null;
    setSwipeOffset(0);
    if (swipeLocked.current !== "h") return;
    swipeLocked.current = null;
    if (Math.abs(dx) > 60 && elapsed < 600) {
      if (dx < 0) {
        if (canGoForward) navigateDate("forward");
      } else {
        navigateDate("back");
      }
    }
  };

  const cleanupDrag = useCallback(() => {
    if (dragRef.current?.longPressTimer) {
      clearTimeout(dragRef.current.longPressTimer);
    }
    if (scrollRef.current) {
      scrollRef.current.style.overflowY = "";
    }
    setDraggingLogId(null);
    setDragCenterPx(null);
    dragRef.current = null;
  }, []);

  const commitDrag = useCallback(() => {
    if (draggingLogId !== null && dragCenterPx !== null && dragRef.current?.hasMoved) {
      const newMinutes = topPxToMinutes(dragCenterPx);
      const roundedMin = Math.round(newMinutes / 5) * 5;
      const log = dayLogs.find((l: any) => l.id === draggingLogId);
      if (log) {
        const original = new Date(log.createdAt);
        const h = Math.floor(roundedMin / 60);
        const m = roundedMin % 60;
        const updated = setMinutes(setHours(original, h), m);
        updateLogTime.mutate({ id: draggingLogId, createdAt: updated.toISOString() });
      }
    }
    cleanupDrag();
  }, [draggingLogId, dragCenterPx, dayLogs, updateLogTime, cleanupDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent, logId: number, centerPx: number) => {
    if (sleepDragRef.current || draggingSleepId !== null) return;
    const touch = e.touches[0];
    const startY = touch.clientY;

    dragRef.current = {
      logId,
      startTouchY: startY,
      centerPxAtStart: centerPx,
      hasMoved: false,
      longPressTimer: null,
      activated: false,
    };

    dragRef.current.longPressTimer = setTimeout(() => {
      if (!dragRef.current) return;
      dragRef.current.activated = true;
      setDraggingLogId(logId);
      setDragCenterPx(centerPx);
      if (scrollRef.current) {
        scrollRef.current.style.overflowY = "hidden";
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, []);

  useEffect(() => {
    if (draggingLogId === null) return;

    const handleMove = (e: TouchEvent) => {
      if (!dragRef.current || !dragRef.current.activated) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dy = touch.clientY - dragRef.current.startTouchY;
      const newCenter = Math.max(0, Math.min(TOTAL_HEIGHT, dragRef.current.centerPxAtStart + dy));
      setDragCenterPx(newCenter);
      dragRef.current.hasMoved = true;
    };

    const handleEnd = () => {
      commitDrag();
    };

    const handleCancel = () => {
      cleanupDrag();
    };

    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    document.addEventListener("touchcancel", handleCancel);

    return () => {
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleCancel);
    };
  }, [draggingLogId, commitDrag, cleanupDrag]);

  const handlePreDragTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current || dragRef.current.activated) return;
    const touch = e.touches[0];
    const dy = Math.abs(touch.clientY - dragRef.current.startTouchY);
    const dx = Math.abs(touch.pageX - (e.touches[0]?.pageX ?? 0));
    if (dy > 8) {
      if (dragRef.current.longPressTimer) {
        clearTimeout(dragRef.current.longPressTimer);
        dragRef.current.longPressTimer = null;
      }
      dragRef.current = null;
    }
  }, []);

  const handlePreDragTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    if (dragRef.current.longPressTimer) {
      clearTimeout(dragRef.current.longPressTimer);
    }
    if (!dragRef.current.activated) {
      const logId = dragRef.current.logId;
      dragRef.current = null;
      e.preventDefault();
      const log = dayLogs.find((l: any) => l.id === logId);
      if (log) {
        openLogEditor(log);
      }
    }
  }, [dayLogs]);

  const dragTimeDisplay = useMemo(() => {
    if (dragCenterPx === null) return null;
    const min = topPxToMinutes(dragCenterPx);
    const rounded = Math.round(min / 5) * 5;
    return minutesToTimeStr(rounded);
  }, [dragCenterPx]);

  const cleanupSleepDrag = useCallback(() => {
    if (sleepDragRef.current?.longPressTimer) {
      clearTimeout(sleepDragRef.current.longPressTimer);
    }
    if (scrollRef.current) {
      scrollRef.current.style.overflowY = "";
    }
    setDraggingSleepId(null);
    setSleepDragTopPx(null);
    sleepDragRef.current = null;
  }, []);

  const commitSleepDrag = useCallback(() => {
    if (draggingSleepId !== null && sleepDragTopPx !== null && sleepDragRef.current?.hasMoved) {
      const ref = sleepDragRef.current;
      const origTopMin = topPxToMinutes(ref.topPxAtStart);
      const newTopMin = topPxToMinutes(sleepDragTopPx);
      const offsetMin = Math.round((newTopMin - origTopMin) / 5) * 5;

      if (offsetMin !== 0) {
        const session = ref.session;
        const origStart = new Date(session.startedAt);
        const newStart = new Date(origStart.getTime() + offsetMin * 60000);
        let newEnd: string | undefined;
        if (session.endedAt) {
          const origEnd = new Date(session.endedAt);
          newEnd = new Date(origEnd.getTime() + offsetMin * 60000).toISOString();
        }
        updateSleepTime.mutate({ id: draggingSleepId, startedAt: newStart.toISOString(), endedAt: newEnd });
      }
    }
    cleanupSleepDrag();
  }, [draggingSleepId, sleepDragTopPx, updateSleepTime, cleanupSleepDrag]);

  const handleSleepTouchStart = useCallback((e: React.TouchEvent, session: any, topPx: number, heightPx: number) => {
    if (!session.id) return;
    if (dragRef.current || draggingLogId !== null) return;
    const touch = e.touches[0];

    sleepDragRef.current = {
      sessionId: session.id,
      startTouchY: touch.clientY,
      topPxAtStart: topPx,
      heightPx,
      hasMoved: false,
      longPressTimer: null,
      activated: false,
      session,
    };

    sleepDragRef.current.longPressTimer = setTimeout(() => {
      if (!sleepDragRef.current) return;
      sleepDragRef.current.activated = true;
      setDraggingSleepId(session.id);
      setSleepDragTopPx(topPx);
      if (scrollRef.current) {
        scrollRef.current.style.overflowY = "hidden";
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, []);

  useEffect(() => {
    if (draggingSleepId === null) return;

    const handleMove = (e: TouchEvent) => {
      if (!sleepDragRef.current || !sleepDragRef.current.activated) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dy = touch.clientY - sleepDragRef.current.startTouchY;
      const newTop = Math.max(0, Math.min(TOTAL_HEIGHT - sleepDragRef.current.heightPx, sleepDragRef.current.topPxAtStart + dy));
      setSleepDragTopPx(newTop);
      sleepDragRef.current.hasMoved = true;
    };

    const handleEnd = () => { commitSleepDrag(); };
    const handleCancel = () => { cleanupSleepDrag(); };

    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    document.addEventListener("touchcancel", handleCancel);

    return () => {
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleCancel);
    };
  }, [draggingSleepId, commitSleepDrag, cleanupSleepDrag]);

  const handleSleepPreDragTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sleepDragRef.current || sleepDragRef.current.activated) return;
    const touch = e.touches[0];
    const dy = Math.abs(touch.clientY - sleepDragRef.current.startTouchY);
    if (dy > 8) {
      if (sleepDragRef.current.longPressTimer) {
        clearTimeout(sleepDragRef.current.longPressTimer);
        sleepDragRef.current.longPressTimer = null;
      }
      sleepDragRef.current = null;
    }
  }, []);

  const handleSleepPreDragTouchCancel = useCallback(() => {
    if (!sleepDragRef.current) return;
    if (sleepDragRef.current.longPressTimer) {
      clearTimeout(sleepDragRef.current.longPressTimer);
    }
    sleepDragRef.current = null;
  }, []);

  const handleSleepPreDragTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!sleepDragRef.current) return;
    if (sleepDragRef.current.longPressTimer) {
      clearTimeout(sleepDragRef.current.longPressTimer);
    }
    if (!sleepDragRef.current.activated) {
      const session = sleepDragRef.current.session;
      sleepDragRef.current = null;
      e.preventDefault();
      if (session?.id) {
        const start = new Date(session.startedAt);
        const end = session.endedAt ? new Date(session.endedAt) : new Date();
        setEditingSleep(session); setSleepEditMode(false);
        setEditSleepStart(format(start, "yyyy-MM-dd'T'HH:mm"));
        setEditSleepEnd(session.endedAt ? format(end, "yyyy-MM-dd'T'HH:mm") : "");
        if (session.endedAt && session.durationMin) {
          const calcMin = Math.round((end.getTime() - start.getTime()) / 60000);
          setEditWakingMinutes(Math.max(0, calcMin - session.durationMin));
        } else {
          setEditWakingMinutes(0);
        }
        const assocLog = allLogs?.find((l: any) =>
          l.type === "sleep" &&
          Math.abs(new Date(l.createdAt).getTime() - new Date(session.startedAt).getTime()) < 2 * 60 * 1000
        );
        setEditingSleepLogId(assocLog?.id ?? null);
        setTlSettlingMethod(
          assocLog?.settlingMethod && assocLog.settlingMethod !== "なし"
            ? assocLog.settlingMethod.split("・")
            : assocLog?.settlingMethod === "なし" ? ["なし"] : []
        );
        setTlSleepLocation(assocLog?.sleepLocation ?? "");
        setTlSleepNote(assocLog?.sleepNote ?? "");
      }
    }
  }, [allLogs]);

  const sleepDragTimeDisplay = useMemo(() => {
    if (sleepDragTopPx === null || !sleepDragRef.current) return null;
    const startMin = topPxToMinutes(sleepDragTopPx);
    const roundedStart = Math.round(startMin / 5) * 5;
    const endMin = topPxToMinutes(sleepDragTopPx + sleepDragRef.current.heightPx);
    const roundedEnd = Math.round(endMin / 5) * 5;
    return `${minutesToTimeStr(roundedStart)} - ${minutesToTimeStr(roundedEnd)}`;
  }, [sleepDragTopPx]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-28">
      <Header />

      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-gray-800" data-testid="text-timeline-title">
            1週間タイムライン
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/daily-stats")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-indigo-50 border border-indigo-100"
              data-testid="button-daily-stats"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-bold text-indigo-600">分析</span>
            </button>
            <button
              onClick={() => setLocation("/log-review")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-green-50 border border-green-100"
              data-testid="button-log-review"
            >
              <Star className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-bold text-green-600">振り返り</span>
            </button>
            <button
              onClick={async () => {
                if (pdfExporting) return;
                setPdfExporting(true);
                try {
                  await generateTimelinePdf(familyId, logs ?? [], sleepSessions ?? [], selectedDate);
                } catch (e) {
                  console.error("PDF export failed:", e);
                  toast({ title: "PDFの作成に失敗しました", variant: "destructive" });
                } finally {
                  setPdfExporting(false);
                }
              }}
              disabled={pdfExporting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-rose-50 border border-rose-100 disabled:opacity-50"
              data-testid="button-export-pdf"
            >
              {pdfExporting ? (
                <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className="text-xs font-bold text-rose-600">{pdfExporting ? "作成中" : "PDF"}</span>
            </button>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-purple-50 border border-purple-100"
              data-testid="button-toggle-date-picker"
            >
              <CalendarDays className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-600">
                {format(selectedDate, "M/d")}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`px-4 mb-2 overflow-hidden transition-all duration-200 ${showDatePicker ? "max-h-40 opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}
        style={showDatePicker ? undefined : { margin: 0, padding: 0 }}
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("back")}
            disabled={!canGoBack}
            className="shrink-0 w-8 h-8 rounded-full disabled:opacity-30"
            data-testid="button-date-back"
          >
            <ChevronLeft className="w-4 h-4 text-purple-500" />
          </Button>

          <div
            ref={dateChipsRef}
            className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1"
            data-testid="date-chips"
          >
            {dateChips.map((date) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={date.getTime()}
                  onClick={() => setSelectedDate(date)}
                  className={`shrink-0 flex flex-col items-center px-3 py-1.5 rounded-2xl transition-all ${
                    isSelected
                      ? "bg-purple-500 text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-100 active:bg-purple-50"
                  }`}
                  data-testid={`date-chip-${format(date, "yyyy-MM-dd")}`}
                >
                  <span className={`text-[10px] font-bold ${isSelected ? "text-purple-100" : "text-gray-400"}`}>
                    {format(date, "EEE", { locale: ja })}
                  </span>
                  <span className={`text-sm font-black leading-tight ${isSelected ? "text-white" : ""}`}>
                    {format(date, "d")}
                  </span>
                  {isToday && (
                    <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white" : "bg-purple-400"}`} />
                  )}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("forward")}
            disabled={!canGoForward}
            className="shrink-0 w-8 h-8 rounded-full disabled:opacity-30"
            data-testid="button-date-forward"
          >
            <ChevronRight className="w-4 h-4 text-purple-500" />
          </Button>
        </div>

        <div className="flex flex-col items-center mt-1 gap-0.5">
          <p className="text-xs text-gray-400 font-bold text-center">
            {format(selectedDate, "M月d日 (EEEE)", { locale: ja })}
            {isSelectedToday && " - 今日"}
          </p>
          {daySleepTotalMinutes > 0 && (
            <p className="text-[11px] font-bold text-indigo-400" data-testid="text-day-sleep-total">
              <Moon className="w-3 h-3 inline mr-0.5 mb-0.5" />
              睡眠合計{" "}
              {daySleepTotalMinutes >= 60
                ? `${Math.floor(daySleepTotalMinutes / 60)}時間${daySleepTotalMinutes % 60 > 0 ? `${daySleepTotalMinutes % 60}分` : ""}`
                : `${daySleepTotalMinutes}分`}
            </p>
          )}
        </div>
      </div>

      <div
        ref={swipeContainerRef}
        className="px-4"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
      >
        <Card
          className="rounded-3xl overflow-hidden border-none shadow-sm transition-transform duration-75"
          style={{ transform: swipeOffset !== 0 ? `translateX(${Math.sign(swipeOffset) * Math.min(Math.abs(swipeOffset) * 0.25, 18)}px)` : undefined }}
          data-testid="timeline-container"
        >
          <div
            ref={scrollRef}
            className="relative overflow-y-auto"
            style={{ height: showDatePicker ? "calc(100vh - 380px)" : "calc(100vh - 280px)" }}
          >
            <div className="relative" style={{ height: TOTAL_HEIGHT }}>
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  <span className="absolute left-3 -top-2.5 text-[10px] font-bold text-gray-400 bg-white px-1 tabular-nums">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
              <div
                className="absolute left-12 w-px bg-purple-100"
                style={{ top: 0, height: TOTAL_HEIGHT }}
              />

              {daySleepSessions.map((session: any, idx: number) => {
                const start = new Date(session.startedAt);
                const end = session.endedAt ? new Date(session.endedAt) : new Date();
                let startMin = isSameDay(start, selectedDate) ? minutesFromMidnight(start) : 0;
                let endMin = isSameDay(end, selectedDate) ? minutesFromMidnight(end) : 24 * 60 - 1;
                if (endMin <= startMin) endMin = startMin + 10;

                const top = minutesToTopPx(startMin);
                const height = Math.max(20, minutesToTopPx(endMin) - top);
                const duration = session.durationMin || differenceInMinutes(end, start);

                const isSleepDragging = draggingSleepId === session.id;
                const displayTop = isSleepDragging && sleepDragTopPx !== null ? sleepDragTopPx : top;

                const assocLog = allLogs?.find((l: any) =>
                  l.type === "sleep" &&
                  Math.abs(new Date(l.createdAt).getTime() - new Date(session.startedAt).getTime()) < 2 * 60 * 1000
                );
                const displayMethod = assocLog?.settlingMethod && assocLog.settlingMethod !== "なし"
                  ? assocLog.settlingMethod : null;
                const displayLocation = assocLog?.sleepLocation || null;
                const displayNote = assocLog?.sleepNote || null;

                const openSleepEditor = () => {
                  if (draggingSleepId !== null) return;
                  if (!session.id) return;
                  setEditingSleep(session); setSleepEditMode(false);
                  setEditSleepStart(format(start, "yyyy-MM-dd'T'HH:mm"));
                  setEditSleepEnd(session.endedAt ? format(end, "yyyy-MM-dd'T'HH:mm") : "");
                  if (session.endedAt && session.durationMin) {
                    const calcMin = Math.round((end.getTime() - start.getTime()) / 60000);
                    setEditWakingMinutes(Math.max(0, calcMin - session.durationMin));
                  } else {
                    setEditWakingMinutes(0);
                  }
                  setEditingSleepLogId(assocLog?.id ?? null);
                  setTlSettlingMethod(
                    assocLog?.settlingMethod && assocLog.settlingMethod !== "なし"
                      ? assocLog.settlingMethod.split("・")
                      : assocLog?.settlingMethod === "なし" ? ["なし"] : []
                  );
                  setTlSleepLocation(assocLog?.sleepLocation ?? "");
                };

                return (
                  <Fragment key={`sleep-${session.id || idx}`}>
                    {/* Always-tappable Moon button in time gutter (never covered by log entries) */}
                    {session.id && !isSleepDragging && (
                      <button
                        data-testid={`button-sleep-edit-gutter-${session.id}`}
                        onClick={openSleepEditor}
                        className="absolute z-20 flex items-center justify-center w-6 h-6 rounded-full bg-purple-200/80 border border-purple-300/60 shadow-sm active:scale-95 transition-transform"
                        style={{
                          top: displayTop + Math.max(0, height / 2 - 12),
                          left: 2,
                        }}
                        title="ねんねを編集"
                      >
                        <Moon className="w-3 h-3 text-purple-500" />
                      </button>
                    )}
                  <div
                    className={`absolute left-14 right-3 rounded-2xl bg-purple-100/60 border border-purple-200/50 select-none ${
                      isSleepDragging ? "z-50 opacity-95 shadow-lg ring-2 ring-purple-300" : ""
                    }`}
                    style={{
                      top: displayTop,
                      height,
                      pointerEvents: isSleepDragging ? "auto" : "none",
                    }}
                    data-testid={`timeline-sleep-${session.id || idx}`}
                  >
                    <div
                      className={`h-full w-full flex items-center justify-center cursor-pointer ${isSleepDragging ? "touch-none" : ""}`}
                      style={{ pointerEvents: "auto" }}
                      onTouchStart={(e) => handleSleepTouchStart(e, session, top, height)}
                      onTouchMove={handleSleepPreDragTouchMove}
                      onTouchEnd={handleSleepPreDragTouchEnd}
                      onTouchCancel={handleSleepPreDragTouchCancel}
                      onClick={() => {
                        if (draggingSleepId !== null) return;
                        if (!session.id) return;
                        setEditingSleep(session); setSleepEditMode(false);
                        setEditSleepStart(format(start, "yyyy-MM-dd'T'HH:mm"));
                        setEditSleepEnd(session.endedAt ? format(end, "yyyy-MM-dd'T'HH:mm") : "");
                        if (session.endedAt && session.durationMin) {
                          const calcMin = Math.round((end.getTime() - start.getTime()) / 60000);
                          setEditWakingMinutes(Math.max(0, calcMin - session.durationMin));
                        } else {
                          setEditWakingMinutes(0);
                        }
                        setEditingSleepLogId(assocLog?.id ?? null);
                        setTlSettlingMethod(
                          assocLog?.settlingMethod && assocLog.settlingMethod !== "なし"
                            ? assocLog.settlingMethod.split("・")
                            : assocLog?.settlingMethod === "なし" ? ["なし"] : []
                        );
                        setTlSleepLocation(assocLog?.sleepLocation ?? "");
                      }}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 w-full">
                        <div className="flex items-center gap-2">
                          {isSleepDragging && (
                            <GripVertical className="w-3.5 h-3.5 text-purple-400 shrink-0 -ml-1" />
                          )}
                          <Moon className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-black text-purple-500">
                            {isSleepDragging && sleepDragTimeDisplay ? (
                              <span className="text-purple-600">{sleepDragTimeDisplay}</span>
                            ) : (
                              <>ねんね {formatDuration(duration)}</>
                            )}
                          </span>
                          {!isSleepDragging && (
                            <span className="text-[10px] text-purple-400 font-bold">
                              {formatUser(session.createdBy)}
                            </span>
                          )}
                        </div>
                        {!isSleepDragging && height >= 48 && (displayMethod || displayLocation) && (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {displayMethod && (
                              <span className="text-[9px] font-bold bg-purple-200/70 text-purple-600 rounded-full px-1.5 py-0.5 leading-none">
                                {displayMethod}
                              </span>
                            )}
                            {displayLocation && (
                              <span className="text-[9px] font-bold bg-indigo-200/70 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
                                {displayLocation}
                              </span>
                            )}
                          </div>
                        )}
                        {!isSleepDragging && height >= 64 && displayNote && (
                          <p className="text-[10px] text-gray-600 dark:text-gray-300 italic text-center px-1 leading-tight line-clamp-2 mt-0.5">
                            {displayNote}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}

              {dayLogs.map((log: any) => {
                const created = new Date(log.createdAt);
                const min = minutesFromMidnight(created);
                const centerPx = minutesToTopPx(min);
                const info = getLogIcon(log.type, log.subType, log.bodyTemperature);
                const { Icon } = info;
                const detail = getLogDetail(log);

                const isDragging = draggingLogId === log.id;
                const displayCenter = isDragging && dragCenterPx !== null ? dragCenterPx : centerPx;
                const layout = logLayoutMap.get(log.id) ?? { top: centerPx - LOG_ENTRY_HEIGHT / 2, col: 0, totalCols: 1 };
                const displayTop = isDragging ? displayCenter - LOG_ENTRY_HEIGHT / 2 : layout.top;
                const colWidthPercent = layout.totalCols > 1 ? 100 / layout.totalCols : 100;
                const colLeftPercent = layout.col * colWidthPercent;

                const isFever = log.type === "temp" && log.bodyTemperature >= 38.5;
                const feverBg = isFever ? "bg-red-100" : info.bg;
                const feverBorder = isFever ? "border-red-400" : info.border;

                return (
                  <div
                    key={`log-${log.id}`}
                    className={`absolute flex items-center touch-none select-none ${
                      isDragging ? "z-50 opacity-95" : "z-10"
                    }`}
                    style={{
                      top: displayTop,
                      left: isDragging ? '3.5rem' : `calc(3.5rem + (100% - 3.5rem - 0.75rem) * ${colLeftPercent / 100})`,
                      width: isDragging ? 'calc(100% - 3.5rem - 0.75rem)' : `calc((100% - 3.5rem - 0.75rem) * ${colWidthPercent / 100})`,
                    }}
                    data-testid={`timeline-log-${log.id}`}
                    onTouchStart={(e) => handleTouchStart(e, log.id, centerPx)}
                    onTouchMove={handlePreDragTouchMove}
                    onTouchEnd={handlePreDragTouchEnd}
                    onClick={() => {
                      if (draggingLogId !== null) return;
                      openLogEditor(log);
                    }}
                  >
                    <div className={`flex-1 min-w-0 flex items-center gap-1 ${feverBg} ${feverBorder} border rounded-2xl px-2 py-2 transition-shadow ${
                      isDragging ? "shadow-lg ring-2 ring-purple-300 scale-105" : ""
                    } ${isFever && !isDragging ? "ring-2 ring-red-200 shadow-sm shadow-red-100" : ""}`}>
                      {isDragging && (
                        <GripVertical className="w-3.5 h-3.5 text-purple-400 shrink-0 -ml-1" />
                      )}
                      <Icon className={`w-4 h-4 ${info.color} shrink-0`} />
                      {log.spitUp && (
                        <span className="text-[10px] shrink-0" title="吐き戻しあり" data-testid={`badge-spit-up-${log.id}`}>🤮</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-700 leading-tight truncate">
                          {detail || info.label}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {isDragging && dragTimeDisplay ? (
                            <span className="text-purple-600 font-black">{dragTimeDisplay}</span>
                          ) : (
                            format(created, "HH:mm")
                          )}
                          {layout.totalCols <= 2 && <>{" / "}{formatUser(log.performedBy || log.userId)}</>}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {draggingLogId !== null && dragCenterPx !== null && dragTimeDisplay && (
                <div
                  className="absolute left-0 right-0 z-40 pointer-events-none"
                  style={{ top: dragCenterPx }}
                >
                  <div className="flex items-center">
                    <div className="bg-purple-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg ml-1">
                      {dragTimeDisplay}
                    </div>
                    <div className="flex-1 h-[1px] bg-purple-400/60 ml-1" />
                  </div>
                </div>
              )}

              {isSelectedToday && (
                <div
                  ref={currentLineRef}
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: nowTop }}
                  data-testid="timeline-now-line"
                >
                  <div className="flex items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 ml-[38px] shrink-0" />
                    <div className="flex-1 h-[2px] bg-red-500/60" />
                  </div>
                </div>
              )}

              {dayLogs.length === 0 && daySleepSessions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <p className="text-sm font-bold">この日の記録はありません</p>
                    <p className="text-xs mt-1">ログを追加するとここに表示されます</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={!!editingLog} onOpenChange={() => { setEditingLog(null); setLogEditMode(false); }}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center">
              {logEditMode ? "記録を編集" : "記録の詳細"}
            </DialogTitle>
          </DialogHeader>
          {editingLog && (() => {
            const info = getLogIcon(editingLog.type, editingLog.subType, editingLog.bodyTemperature);
            const detail = getLogDetail(editingLog);
            const LogIcon = info.Icon;
            const isMilk = editingLog.type === "milk";
            const isBreast = editingLog.subType === "breast";
            const isExpressed = editingLog.subType === "expressed";
            const isFormula = !isBreast && !isExpressed;
            const logDate = new Date(editingLog.createdAt);
            const createdByLabel = formatUser(editingLog.performedBy || editingLog.userId);

            if (!logEditMode) {
              return (
                <div className="space-y-4 py-2">
                  <div className={`flex items-center gap-3 ${info.bg} ${info.border} border rounded-2xl px-4 py-3`}>
                    <LogIcon className={`w-5 h-5 ${info.color} shrink-0`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">{info.label}</p>
                      {detail && <p className="text-xs text-gray-500">{detail}</p>}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-bold">記録時間</span>
                      <span className="text-sm font-bold text-gray-700" data-testid="text-log-time">
                        {format(logDate, "M月d日 HH:mm", { locale: ja })}
                      </span>
                    </div>
                    {editingLog.foodItems && (() => {
                      let entries: { name: string; amount: string }[] | null = null;
                      try { const p = JSON.parse(editingLog.foodItems); if (Array.isArray(p)) entries = p; } catch {}
                      const amountColor = (a: string) =>
                        a === "完食" ? "text-green-600" : a === "半分" ? "text-amber-500" : a === "ひと口" ? "text-sky-500" : a === "拒否" ? "text-rose-500" : "text-gray-600";
                      return entries ? (
                        <div className="border-t pt-2 space-y-1" data-testid="text-food-items">
                          <span className="text-xs text-gray-400 font-bold">食べたもの</span>
                          {entries.map((e, i) => (
                            <div key={i} className="flex items-center justify-between pl-1">
                              <span className="text-sm font-bold text-gray-700">{e.name || "（食材）"}</span>
                              <span className={`text-sm font-black ${amountColor(e.amount)}`}>{e.amount}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-start justify-between border-t pt-2 gap-3">
                          <span className="text-xs text-gray-400 font-bold shrink-0">食べたもの</span>
                          <p className="text-sm font-bold text-gray-700 text-right" data-testid="text-food-items">{editingLog.foodItems}</p>
                        </div>
                      );
                    })()}
                    {editingLog.foodAmount && (() => {
                      let isNew = false;
                      try { const p = JSON.parse(editingLog.foodItems ?? ""); if (Array.isArray(p)) isNew = true; } catch {}
                      return isNew ? null : (
                        <div className="flex items-center justify-between border-t pt-2">
                          <span className="text-xs text-gray-400 font-bold shrink-0">食べた量</span>
                          <p className="text-sm font-bold text-gray-700" data-testid="text-food-amount">{editingLog.foodAmount}</p>
                        </div>
                      );
                    })()}
                    {editingLog.type === "food" && editingLog.foodNote && (
                      <div className="border-t pt-2 space-y-0.5">
                        <span className="text-xs text-gray-400 font-bold">食事メモ</span>
                        <p className="text-sm text-gray-600 leading-relaxed" data-testid="text-food-note">{editingLog.foodNote}</p>
                      </div>
                    )}
                    {editingLog.message && ["milestone", "achievement", "words", "hobby", "play", "snack", "school_report", "school_prep"].includes(editingLog.type) && (
                      <div className="flex items-start justify-between border-t pt-2 gap-3">
                        <span className="text-xs text-gray-400 font-bold shrink-0">内容</span>
                        <p className="text-sm font-bold text-gray-700 text-right break-words max-w-[180px]" data-testid="text-log-message">
                          {(() => {
                            const prefixMap: Record<string, string> = { words: "ことば: ", school_report: "園の記録: ", school_prep: "入学準備: " };
                            const p = prefixMap[editingLog.type as string];
                            return p && editingLog.message?.startsWith(p) ? editingLog.message.slice(p.length) : editingLog.message;
                          })()}
                        </p>
                      </div>
                    )}
                    {editingLog.type === "sleep" && (editingLog.settlingMethod || editingLog.settlingMinutes || editingLog.sleepLocation || editingLog.sleepNote) && (
                      <div className="border-t pt-2 space-y-1">
                        <span className="text-xs text-gray-400 font-bold">ねんね詳細</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {editingLog.settlingMethod && editingLog.settlingMethod !== "なし" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold">
                              寝かしつけ：{editingLog.settlingMethod}
                            </span>
                          )}
                          {editingLog.settlingMinutes != null && editingLog.settlingMinutes > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold">
                              {editingLog.settlingMinutes}分かかった
                            </span>
                          )}
                          {editingLog.sleepLocation && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-sky-100 text-sky-700 text-xs font-bold">
                              {editingLog.sleepLocation}
                            </span>
                          )}
                        </div>
                        {editingLog.sleepNote && (
                          <p className="text-xs text-gray-700 dark:text-gray-300 italic mt-1.5 whitespace-pre-wrap">
                            「{editingLog.sleepNote}」
                          </p>
                        )}
                      </div>
                    )}
                    {isMilk && editingLog.spitUp && (
                      <div className="flex items-start justify-between border-t pt-2">
                        <span className="text-xs text-gray-400 font-bold">🤮 吐き戻し</span>
                        <div className="text-right space-y-0.5">
                          {editingLog.spitUpAmount && (
                            <p className="text-xs font-bold text-orange-600">
                              { {small: "少し", half: "半分くらい", most: "ほぼ全部"}[editingLog.spitUpAmount as string] }
                            </p>
                          )}
                          {editingLog.spitUpTiming && (
                            <p className="text-xs text-gray-500">
                              { {immediate: "直後", within_30min: "30分以内", within_1hour: "1時間以内"}[editingLog.spitUpTiming as string] }
                            </p>
                          )}
                          {editingLog.spitUpNote && (
                            <p className="text-xs text-gray-400 max-w-[160px] text-right">{editingLog.spitUpNote}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLogEditMode(true)}
                      className="flex-1 h-11 rounded-2xl bg-purple-500 text-white font-bold"
                      data-testid="button-edit-log"
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmingDeleteLog(editingLog)}
                      className="h-11 rounded-2xl border-2 border-red-200 text-red-500 font-bold px-4"
                      data-testid="button-delete-log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-4 py-2">
                <div className={`flex items-center gap-3 ${info.bg} ${info.border} border rounded-2xl px-4 py-3`}>
                  <LogIcon className={`w-5 h-5 ${info.color} shrink-0`} />
                  <div>
                    <p className="text-sm font-bold text-gray-700">{info.label}</p>
                    {detail && <p className="text-xs text-gray-500">{detail}</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    記録時間
                  </label>
                  <Input
                    type="datetime-local"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    step="300"
                    className="rounded-xl border-2 text-lg font-bold text-center h-12"
                    data-testid="input-edit-time"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">だれがやった？（複数選択可）</label>
                  <div className="flex gap-2" data-testid="edit-performer-selector">
                    {[
                      { value: "mama", label: mamaLabel, active: "bg-pink-50 border-pink-300 text-pink-600" },
                      { value: "papa", label: papaLabel, active: "bg-blue-50 border-blue-300 text-blue-600" },
                      { value: "other", label: "その他", active: "bg-gray-100 border-gray-400 text-gray-700" },
                    ].map((opt) => {
                      const selected = editPerformers.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          data-testid={`button-edit-performer-${opt.value}`}
                          onClick={() => {
                            setEditPerformers(prev =>
                              prev.includes(opt.value)
                                ? prev.filter(v => v !== opt.value)
                                : [...prev, opt.value]
                            );
                          }}
                          className={`flex-1 py-2 rounded-2xl text-sm font-bold border-2 transition-colors ${
                            selected ? opt.active : "bg-gray-50 border-gray-200 text-gray-400"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {(editingLog?.type === "food" || editingLog?.type === "meal") && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">食事メモ</label>
                    <Textarea
                      data-testid="textarea-edit-food-note"
                      value={editFoodNote}
                      onChange={(e) => setEditFoodNote(e.target.value)}
                      placeholder="気になること、食べた様子など…"
                      className="rounded-xl border-2 border-gray-100 min-h-[80px] text-sm"
                    />
                  </div>
                )}
                {editingLog && MESSAGE_PREFIX_MAP[editingLog.type as string] && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                      {editingLog.type === "school_report" ? "園の記録" : "入学準備"}
                    </label>
                    <Textarea
                      data-testid="textarea-edit-memo"
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      placeholder="今日の様子、伝えたいことなど…"
                      className="rounded-xl border-2 border-gray-100 min-h-[100px] text-sm"
                    />
                  </div>
                )}
                {isMilk && isFormula && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">ミルク量 (ml)</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={editFormulaMl}
                      onChange={(e) => setEditFormulaMl(e.target.value)}
                      placeholder="例: 120"
                      className="rounded-xl border-2 text-lg font-bold text-center h-12"
                      data-testid="input-edit-formula-ml"
                    />
                  </div>
                )}
                {isMilk && isBreast && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1.5 block">左 (分)</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={editBreastLeftMin}
                          onChange={(e) => setEditBreastLeftMin(e.target.value)}
                          placeholder="0"
                          className="rounded-xl border-2 text-lg font-bold text-center h-12"
                          data-testid="input-edit-breast-left"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1.5 block">右 (分)</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={editBreastRightMin}
                          onChange={(e) => setEditBreastRightMin(e.target.value)}
                          placeholder="0"
                          className="rounded-xl border-2 text-lg font-bold text-center h-12"
                          data-testid="input-edit-breast-right"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                        <Checkbox
                          id="edit-breast-expressed"
                          data-testid="checkbox-edit-breast-expressed"
                          checked={editBreastExpressed}
                          onCheckedChange={(checked) => {
                            setEditBreastExpressed(!!checked);
                            if (!checked) setEditExpressedMl("");
                          }}
                        />
                        <Label htmlFor="edit-breast-expressed" className="text-sm font-bold text-blue-900 dark:text-blue-200 cursor-pointer">
                          搾乳した母乳をあげた
                        </Label>
                      </div>
                      {editBreastExpressed && (
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1.5 block">搾乳量 (ml)</label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={editExpressedMl}
                            onChange={(e) => setEditExpressedMl(e.target.value)}
                            placeholder="例: 80"
                            className="rounded-xl border-2 text-lg font-bold text-center h-12"
                            data-testid="input-edit-breast-expressed-ml"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
                {isMilk && isExpressed && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">搾乳量 (ml)</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={editExpressedMl}
                      onChange={(e) => setEditExpressedMl(e.target.value)}
                      placeholder="例: 80"
                      className="rounded-xl border-2 text-lg font-bold text-center h-12"
                      data-testid="input-edit-expressed-ml"
                    />
                  </div>
                )}
                {isMilk && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center space-x-2 bg-orange-50 p-3 rounded-xl border border-orange-100">
                      <Checkbox
                        id="edit-spit-up"
                        data-testid="checkbox-edit-spit-up"
                        checked={editSpitUp}
                        onCheckedChange={(checked) => {
                          setEditSpitUp(!!checked);
                          if (!checked) { setEditSpitUpAmount(""); setEditSpitUpTiming(""); setEditSpitUpNote(""); }
                        }}
                      />
                      <Label htmlFor="edit-spit-up" className="text-sm font-bold text-orange-900 cursor-pointer">
                        吐き戻しあり
                      </Label>
                    </div>
                    {editSpitUp && (
                      <div className="space-y-3 pl-1">
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-gray-500">吐き戻しの量</p>
                          <div className="flex gap-2">
                            {[{value:"small",label:"少し"},{value:"half",label:"半分くらい"},{value:"most",label:"ほぼ全部"}].map((opt) => (
                              <button key={opt.value} type="button" data-testid={`button-edit-spit-amount-${opt.value}`}
                                onClick={() => setEditSpitUpAmount(opt.value)}
                                className={`flex-1 py-2 rounded-2xl text-xs font-bold border-2 transition-colors ${editSpitUpAmount === opt.value ? "bg-orange-100 border-orange-400 text-orange-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                              >{opt.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-gray-500">タイミング</p>
                          <div className="flex gap-2">
                            {[{value:"immediate",label:"直後"},{value:"within_30min",label:"30分以内"},{value:"within_1hour",label:"1時間以内"}].map((opt) => (
                              <button key={opt.value} type="button" data-testid={`button-edit-spit-timing-${opt.value}`}
                                onClick={() => setEditSpitUpTiming(opt.value)}
                                className={`flex-1 py-2 rounded-2xl text-xs font-bold border-2 transition-colors ${editSpitUpTiming === opt.value ? "bg-orange-100 border-orange-400 text-orange-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                              >{opt.label}</button>
                            ))}
                          </div>
                        </div>
                        <Textarea
                          data-testid="textarea-edit-spit-note"
                          value={editSpitUpNote}
                          onChange={(e) => setEditSpitUpNote(e.target.value)}
                          placeholder="例）噴水のように吐いた…"
                          className="rounded-xl border-2 border-gray-100 min-h-[60px] text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
                {editingLog?.type === "sleep" && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        寝かしつけ方法（任意）
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {["抱っこ", "抱っこひも", "添い乳", "添い寝", "なし"].map((m) => (
                          <button
                            key={m}
                            type="button"
                            data-testid={`button-edit-sleep-method-${m}`}
                            onClick={() => {
                              if (m === "なし") {
                                setTlSettlingMethod(tlSettlingMethod.includes("なし") ? [] : ["なし"]);
                              } else {
                                setTlSettlingMethod(prev =>
                                  prev.includes(m) ? prev.filter(x => x !== m) : [...prev.filter(x => x !== "なし"), m]
                                );
                              }
                            }}
                            className={cn(
                              "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                              tlSettlingMethod.includes(m)
                                ? "bg-indigo-500 border-indigo-500 text-white"
                                : "bg-white dark:bg-gray-800 border-indigo-100 dark:border-indigo-800 text-indigo-500"
                            )}
                          >{m}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        ねんね場所（任意）
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {["布団", "抱っこ寝", "ベビーカー", "抱っこひも寝", "チャイルドシート"].map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            data-testid={`button-edit-sleep-location-${loc}`}
                            onClick={() => setTlSleepLocation(tlSleepLocation === loc ? "" : loc)}
                            className={cn(
                              "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                              tlSleepLocation === loc
                                ? "bg-sky-500 border-sky-500 text-white"
                                : "bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-sky-500"
                            )}
                          >{loc}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        ねんねメモ（任意）
                      </p>
                      <Textarea
                        data-testid="textarea-edit-sleep-note"
                        value={tlSleepNote}
                        onChange={(e) => setTlSleepNote(e.target.value)}
                        placeholder="例）ぐっすり寝た／30分おきに泣き寝言／2時に起きてミルク…"
                        className="rounded-xl border-2 border-gray-100 min-h-[70px] text-sm"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setLogEditMode(false)}
                    className="h-12 rounded-2xl border-2 font-bold px-4"
                    data-testid="button-cancel-edit"
                  >
                    戻る
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editingLog || !editTime) return;
                      const updated = new Date(editTime);
                      if (isNaN(updated.getTime())) {
                        toast({ title: "正しい日時を入力してください", variant: "destructive" });
                        return;
                      }
                      const payload: any = { id: editingLog.id, createdAt: updated.toISOString() };
                      if (isMilk) {
                        if (isFormula) payload.formulaMl = editFormulaMl ? parseInt(editFormulaMl) : null;
                        if (isBreast) {
                          payload.breastLeftMin = editBreastLeftMin ? parseInt(editBreastLeftMin) : null;
                          payload.breastRightMin = editBreastRightMin ? parseInt(editBreastRightMin) : null;
                          payload.expressedMl = editBreastExpressed && editExpressedMl ? parseInt(editExpressedMl) : null;
                        }
                        if (isExpressed) payload.expressedMl = editExpressedMl ? parseInt(editExpressedMl) : null;
                        payload.spitUp = editSpitUp;
                        payload.spitUpAmount = editSpitUp ? editSpitUpAmount || null : null;
                        payload.spitUpTiming = editSpitUp ? editSpitUpTiming || null : null;
                        payload.spitUpNote = editSpitUp && editSpitUpNote.trim() ? editSpitUpNote.trim() : null;
                      }
                      if (editPerformers.length > 0) payload.performedBy = editPerformers.join("・");
                      if (editingLog.type === "food") payload.foodNote = editFoodNote.trim() || null;
                      if (editingLog.type === "meal") payload.foodItems = editFoodNote.trim() || null;
                      const memoPrefix = MESSAGE_PREFIX_MAP[editingLog.type as string];
                      if (memoPrefix) {
                        const trimmed = editMemo.trim();
                        payload.message = trimmed ? `${memoPrefix}${trimmed}` : memoPrefix.trim();
                      }
                      updateLog.mutate(payload, {
                        onSuccess: async () => {
                          if (editingLog.type === "sleep") {
                            const sleepDetailPayload: Record<string, string> = {
                              settlingMethod: tlSettlingMethod.length > 0 ? tlSettlingMethod.join("・") : "",
                              sleepLocation: tlSleepLocation,
                            };
                            await fetch(`/api/logs/${editingLog.id}/sleep-detail`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(sleepDetailPayload),
                            });
                            queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
                          }
                          setEditingLog(null);
                        }
                      });
                    }}
                    disabled={updateLogTime.isPending || updateLog.isPending}
                    className="flex-1 h-12 rounded-2xl bg-purple-500 text-white font-bold"
                    data-testid="button-save-time"
                  >
                    {(updateLogTime.isPending || updateLog.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    変更を保存
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmingDeleteLog} onOpenChange={(open) => !open && setConfirmingDeleteLog(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">このログを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500">
              削除すると元に戻せません。ポイントも減算されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center">
            <AlertDialogCancel
              className="flex-1 rounded-2xl font-bold"
              data-testid="button-delete-log-cancel"
            >
              いいえ
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmingDeleteLog) {
                  deleteLog.mutate(confirmingDeleteLog.id, {
                    onSuccess: () => {
                      setConfirmingDeleteLog(null);
                      setEditingLog(null);
                    },
                  });
                }
              }}
              className="flex-1 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600"
              data-testid="button-delete-log-confirm"
            >
              {deleteLog.isPending ? "削除中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingSleep} onOpenChange={() => { setEditingSleep(null); setSleepEditMode(false); }}>
        <DialogContent className="sm:max-w-sm rounded-[2rem] border-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center">
              {sleepEditMode ? "ねんねの時間を編集" : "ねんねの詳細"}
            </DialogTitle>
          </DialogHeader>
          {editingSleep && (() => {
            const startDate = new Date(editingSleep.startedAt);
            const endDate = editingSleep.endedAt ? new Date(editingSleep.endedAt) : null;
            const createdByLabel = editingSleep.createdBy === "papa" ? papaLabel : mamaLabel;
            const calcMin = endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : null;
            const storedWaking = (editingSleep.durationMin && calcMin && calcMin > editingSleep.durationMin)
              ? calcMin - editingSleep.durationMin : 0;
            const durationText = editingSleep.durationMin ? `${editingSleep.durationMin}分` : "記録中...";

            if (!sleepEditMode) {
              return (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
                    <Moon className="w-5 h-5 text-purple-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">ねんね</p>
                      <p className="text-xs text-gray-500">{durationText}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-bold">入眠</span>
                      <span className="text-sm font-bold text-gray-700">
                        {format(startDate, "M月d日 HH:mm", { locale: ja })}
                      </span>
                    </div>
                    {endDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-bold">起床</span>
                        <span className="text-sm font-bold text-gray-700">
                          {format(endDate, "M月d日 HH:mm", { locale: ja })}
                        </span>
                      </div>
                    )}
                    {storedWaking > 0 && (
                      <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                        <span className="text-xs text-amber-500 font-bold">夜中起き</span>
                        <span className="text-sm font-bold text-amber-500">−{storedWaking}分</span>
                      </div>
                    )}
                  </div>
                  {(tlSettlingMethod.length > 0 || tlSleepLocation) && (
                    <div className="flex flex-wrap gap-1.5">
                      {tlSettlingMethod.length > 0 && tlSettlingMethod[0] !== "なし" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                          寝かしつけ：{tlSettlingMethod.join("・")}
                        </span>
                      )}
                      {tlSleepLocation && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 text-xs font-bold">
                          {tlSleepLocation}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSleepEditMode(true)}
                      className="flex-1 h-11 rounded-2xl bg-purple-500 text-white font-bold"
                      data-testid="button-edit-sleep"
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmingDeleteSleep(editingSleep)}
                      className="h-11 rounded-2xl border-2 border-red-200 text-red-500 font-bold px-4"
                      data-testid="button-delete-sleep"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
                  <Moon className="w-5 h-5 text-purple-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gray-700">ねんね</p>
                    <p className="text-xs text-gray-500">{createdByLabel}</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    入眠時刻
                  </label>
                  <Input
                    type="datetime-local"
                    value={editSleepStart}
                    onChange={(e) => setEditSleepStart(e.target.value)}
                    step="300"
                    className="rounded-xl border-2 text-base font-bold text-center h-12"
                    data-testid="input-edit-sleep-start"
                  />
                </div>
                {editingSleep.endedAt && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      起床時刻
                    </label>
                    <Input
                      type="datetime-local"
                      value={editSleepEnd}
                      onChange={(e) => setEditSleepEnd(e.target.value)}
                      step="300"
                      className="rounded-xl border-2 text-base font-bold text-center h-12"
                      data-testid="input-edit-sleep-end"
                    />
                  </div>
                )}
                {editingSleep.endedAt && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                      夜中に起きていた時間（分）
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={editWakingMinutes}
                        onChange={(e) => setEditWakingMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        className="rounded-xl border-2 text-base font-bold text-center h-12"
                        data-testid="input-edit-waking-minutes"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-400 font-bold whitespace-nowrap">分</span>
                    </div>
                    {editWakingMinutes > 0 && editSleepStart && editSleepEnd && (() => {
                      const s = new Date(editSleepStart);
                      const e = new Date(editSleepEnd);
                      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
                        const net = Math.round((e.getTime() - s.getTime()) / 60000) - editWakingMinutes;
                        if (net > 0) return (
                          <p className="text-xs text-purple-500 font-bold mt-1">
                            実質睡眠時間：{net}分
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                <div className="border-t pt-3 space-y-3">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      寝かしつけ方法（任意）
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["抱っこ", "抱っこひも", "添い乳", "添い寝", "なし"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          data-testid={`button-sleep-method-${m}`}
                          onClick={() => {
                            if (m === "なし") {
                              setTlSettlingMethod(tlSettlingMethod.includes("なし") ? [] : ["なし"]);
                            } else {
                              setTlSettlingMethod(prev =>
                                prev.includes(m) ? prev.filter(x => x !== m) : [...prev.filter(x => x !== "なし"), m]
                              );
                            }
                          }}
                          className={cn(
                            "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                            tlSettlingMethod.includes(m)
                              ? "bg-indigo-500 border-indigo-500 text-white"
                              : "bg-white dark:bg-gray-800 border-indigo-100 dark:border-indigo-800 text-indigo-500"
                          )}
                        >{m}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      ねんね場所（任意）
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["布団", "抱っこ寝", "ベビーカー", "抱っこひも寝", "チャイルドシート"].map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          data-testid={`button-sleep-location-${loc}`}
                          onClick={() => setTlSleepLocation(tlSleepLocation === loc ? "" : loc)}
                          className={cn(
                            "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                            tlSleepLocation === loc
                              ? "bg-sky-500 border-sky-500 text-white"
                              : "bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-sky-500"
                          )}
                        >{loc}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSleepEditMode(false)}
                    className="h-12 rounded-2xl border-2 font-bold px-4"
                    data-testid="button-cancel-sleep-edit"
                  >
                    戻る
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editingSleep || !editSleepStart) return;
                      const newStart = new Date(editSleepStart);
                      if (isNaN(newStart.getTime())) {
                        toast({ title: "入眠時刻が正しくありません", variant: "destructive" });
                        return;
                      }
                      let newEnd: string | undefined;
                      if (editingSleep.endedAt && editSleepEnd) {
                        const endDate = new Date(editSleepEnd);
                        if (isNaN(endDate.getTime())) {
                          toast({ title: "起床時刻が正しくありません", variant: "destructive" });
                          return;
                        }
                        if (endDate <= newStart) {
                          toast({ title: "起床時刻は入眠時刻より後にしてください", variant: "destructive" });
                          return;
                        }
                        newEnd = endDate.toISOString();
                      }
                      updateSleepTime.mutate(
                        { id: editingSleep.id, startedAt: newStart.toISOString(), endedAt: newEnd, wakingMinutes: editWakingMinutes },
                        {
                          onSuccess: async () => {
                            if (editingSleepLogId) {
                              await fetch(`/api/logs/${editingSleepLogId}/sleep-detail`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  settlingMethod: tlSettlingMethod.length > 0 ? tlSettlingMethod.join("・") : "",
                                  sleepLocation: tlSleepLocation,
                                  sleepNote: tlSleepNote.trim() || null,
                                }),
                              });
                              queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
                            }
                            setEditingSleep(null);
                          }
                        }
                      );
                    }}
                    disabled={updateSleepTime.isPending}
                    className="flex-1 h-12 rounded-2xl bg-purple-500 text-white font-bold"
                    data-testid="button-save-sleep-time"
                  >
                    {updateSleepTime.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    変更を保存
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmingDeleteSleep} onOpenChange={(open) => !open && setConfirmingDeleteSleep(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">睡眠記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500">
              削除すると元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center">
            <AlertDialogCancel
              className="flex-1 rounded-2xl font-bold"
              data-testid="button-delete-sleep-cancel"
            >
              いいえ
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmingDeleteSleep) {
                  deleteSleepSession.mutate(confirmingDeleteSleep.id, {
                    onSuccess: () => {
                      setConfirmingDeleteSleep(null);
                      setEditingSleep(null);
                    },
                  });
                }
              }}
              className="flex-1 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600"
              data-testid="button-delete-sleep-confirm"
            >
              {deleteSleepSession.isPending ? "削除中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Sleep Entry Dialog */}
      <Dialog open={showManualSleepDialog} onOpenChange={(open) => { if (!open) { setShowManualSleepDialog(false); setTlManualSleepError(""); setTlManualNoEnd(false); } }}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl p-5 max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base font-black text-indigo-700 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              過去のねんねを手入力
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 overflow-y-auto flex-1 -mx-1 px-1">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5" />
                入眠日時
              </label>
              <ScrollDateTimePicker value={tlManualStartTime} onChange={setTlManualStartTime} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5" />
                  起床日時
                </label>
                {!(activeSession?.id && !activeSession.endedAt) && (
                  <button
                    type="button"
                    data-testid="button-tl-toggle-no-end"
                    onClick={() => { setTlManualNoEnd(v => !v); setTlManualEndTime(""); setTlManualSleepError(""); }}
                    className={cn(
                      "text-[11px] font-bold px-2.5 py-1 rounded-xl border-2 transition-colors",
                      tlManualNoEnd
                        ? "bg-indigo-100 border-indigo-300 text-indigo-600"
                        : "bg-white border-gray-200 text-gray-400"
                    )}
                  >
                    {tlManualNoEnd ? "まだ起きていない" : "入力しない"}
                  </button>
                )}
              </div>
              {!tlManualNoEnd && (
                <ScrollDateTimePicker value={tlManualEndTime} onChange={(v) => { setTlManualEndTime(v); setTlManualSleepError(""); }} daysAfter={1} />
              )}
              {tlManualNoEnd && (
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                  <p className="text-xs font-bold text-indigo-500">ねんね開始として記録します。</p>
                </div>
              )}
            </div>

            {!tlManualNoEnd && (() => {
              const start = tlManualStartTime ? new Date(tlManualStartTime) : null;
              const end = tlManualEndTime ? new Date(tlManualEndTime) : null;
              const durationMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
              return durationMin > 0 ? (
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                  <p className="text-sm font-black text-indigo-700">
                    {Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}時間` : ""}{durationMin % 60}分のねんね
                  </p>
                </div>
              ) : null;
            })()}

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                <Moon className="w-3 h-3" />
                寝かしつけ方法（任意）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["抱っこ", "抱っこひも", "添い乳", "添い寝", "なし"].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      if (m === "なし") {
                        setTlSettlingMethod(tlSettlingMethod.includes("なし") ? [] : ["なし"]);
                      } else {
                        setTlSettlingMethod(prev =>
                          prev.includes(m) ? prev.filter(x => x !== m) : [...prev.filter(x => x !== "なし"), m]
                        );
                      }
                    }}
                    className={cn(
                      "px-3 h-7 rounded-xl text-xs font-bold border-2 transition-colors",
                      tlSettlingMethod.includes(m)
                        ? "bg-indigo-500 border-indigo-500 text-white"
                        : "bg-white border-indigo-100 text-indigo-500"
                    )}
                  >{m}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                <Moon className="w-3 h-3" />
                ねんね場所（任意）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["布団", "抱っこ寝", "抱っこひも寝", "ベビーカー", "チャイルドシート"].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setTlSleepLocation(tlSleepLocation === loc ? "" : loc)}
                    className={cn(
                      "px-3 h-7 rounded-xl text-xs font-bold border-2 transition-colors",
                      tlSleepLocation === loc
                        ? "bg-sky-500 border-sky-500 text-white"
                        : "bg-white border-sky-100 text-sky-500"
                    )}
                  >{loc}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                <Moon className="w-3 h-3" />
                ねんねメモ（任意）
              </p>
              <Textarea
                data-testid="textarea-tl-manual-sleep-note"
                value={tlSleepNote}
                onChange={(e) => setTlSleepNote(e.target.value)}
                placeholder="例）ぐっすり寝た／30分おきに泣き寝言／2時に起きてミルク…"
                className="rounded-xl border-2 border-gray-100 min-h-[70px] text-sm"
              />
            </div>

            {tlManualSleepError && (
              <p className="text-xs text-red-500 font-bold text-center">{tlManualSleepError}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowManualSleepDialog(false)}
                className="h-12 rounded-2xl border-2 font-bold px-4"
                data-testid="button-tl-manual-sleep-cancel"
              >
                キャンセル
              </Button>
              <Button
                data-testid="button-tl-manual-sleep-submit"
                onClick={() => {
                  const start = tlManualStartTime ? new Date(tlManualStartTime) : null;
                  if (!start) { setTlManualSleepError("入眠時刻を入力してください"); return; }
                  const userId = localStorage.getItem("userType") || "papa";
                  if (tlManualNoEnd) {
                    startSleep.mutate({
                      familyId,
                      createdBy: userId,
                      ...(activeChildIdForSleep ? { childId: activeChildIdForSleep } : {}),
                      startedAt: start.toISOString(),
                      ...(tlSettlingMethod.length > 0 ? { settlingMethod: tlSettlingMethod.join("・") } : {}),
                      ...(tlSleepLocation ? { sleepLocation: tlSleepLocation } : {}),
                      ...(tlSleepNote.trim() ? { sleepNote: tlSleepNote.trim() } : {}),
                    }, {
                      onSuccess: () => {
                        setShowManualSleepDialog(false);
                      },
                    });
                  } else {
                    const end = tlManualEndTime ? new Date(tlManualEndTime) : null;
                    if (!end) { setTlManualSleepError("起床時刻を入力してください（「入力しない」を使うと省略できます）"); return; }
                    if (end <= start) { setTlManualSleepError("起床時刻は入眠時刻より後にしてください"); return; }
                    const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                    manualSleep.mutate({
                      familyId,
                      createdBy: userId,
                      durationMin,
                      startedAt: start.toISOString(),
                      ...(tlSettlingMethod.length > 0 ? { settlingMethod: tlSettlingMethod.join("・") } : {}),
                      ...(tlSleepLocation ? { sleepLocation: tlSleepLocation } : {}),
                      ...(tlSleepNote.trim() ? { sleepNote: tlSleepNote.trim() } : {}),
                    }, {
                      onSuccess: () => {
                        setShowManualSleepDialog(false);
                      },
                    });
                  }
                }}
                disabled={manualSleep.isPending || startSleep.isPending}
                className="flex-1 h-12 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black text-base shadow-lg shadow-indigo-100"
              >
                {(manualSleep.isPending || startSleep.isPending) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : tlManualNoEnd ? "ねんね開始" : "記録する"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add FAB */}
      <button
        data-testid="button-timeline-quick-add"
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#805AAA] text-white shadow-xl shadow-purple-200 flex items-center justify-center active:scale-95 transition-transform"
        aria-label="きろくを追加"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Quick Add Sheet */}
      <Sheet open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-safe max-h-[85dvh] overflow-y-auto">
          <SheetHeader className="px-5 pb-2 shrink-0">
            <SheetTitle className="text-base font-black text-[#805AAA] flex items-center gap-2">
              <Plus className="w-4 h-4" />
              きろくを追加
            </SheetTitle>
          </SheetHeader>
          <QuickActions />
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
}
