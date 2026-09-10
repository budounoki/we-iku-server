import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Minus, Sun, Moon, Edit3, Sparkles, Clock, ClipboardList, Droplets, CircleDot, X, ChevronDown, ChevronUp, Check, Stethoscope, HelpCircle, Timer, GripVertical, Star, Heart, Baby, Pill, Bath, Scissors, ThumbsUp, MessageCircle, Palette, Apple, Utensils, Activity, BookOpen, Smile, Zap, Music, Camera, Dumbbell, Leaf, Trash2, GlassWater } from "lucide-react";
import { format } from "date-fns";
import { useCreateLog, useSettings, useActiveSleepSession, useStartSleepSession, useEndSleepSession, useManualSleepSession, useUpdateSleepTime } from "@/hooks/use-app-data";
import { useUserLabels } from "@/hooks/use-user-labels";
import { useLocation } from "wouter";
import { useActiveChild } from "@/hooks/use-active-child";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FOOD_CATEGORIES } from "@/lib/food-categories";
import { differenceInMonths, parseISO, differenceInMinutes } from "date-fns";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPhaseForAge, getActionsForPhase, getAllActions, PhaseActionConfig, PLAY_OPTIONS } from "@/lib/phases";
import { cn } from "@/lib/utils";
import { DateTimeClock, DateTimeClock24, ClockTimePicker, Clock24TimePicker } from "@/components/ClockTimePicker";
import { ScrollTimePicker, ScrollDateTimePicker } from "@/components/ScrollWheelPicker";

const POOP_COLORS = [
  { id: "yellow", label: "黄色", color: "bg-yellow-400" },
  { id: "green", label: "緑色", color: "bg-green-500" },
  { id: "brown", label: "茶色", color: "bg-amber-700" },
  { id: "black", label: "黒色", color: "bg-gray-800" },
  { id: "white", label: "白色", color: "bg-gray-100 border border-gray-300" },
  { id: "red", label: "赤色", color: "bg-red-500" },
];

const POOP_CONSISTENCY = [
  { id: "normal", label: "普通" },
  { id: "hard", label: "硬い" },
  { id: "soft", label: "軟らかい" },
  { id: "watery", label: "水っぽい" },
];

const SYMPTOM_OPTIONS = [
  { id: "cough", label: "咳" },
  { id: "runny_nose", label: "鼻水" },
  { id: "rash", label: "湿疹" },
  { id: "vomit", label: "嘔吐" },
  { id: "diarrhea", label: "下痢" },
  { id: "fever", label: "発熱" },
];

const STOOL_AMOUNTS = [
  { id: "small", label: "少量" },
  { id: "medium", label: "普通" },
  { id: "large", label: "多い" },
];

const CUSTOM_ICON_OPTIONS = [
  { name: "Star", Icon: Star }, { name: "Heart", Icon: Heart }, { name: "Baby", Icon: Baby },
  { name: "Smile", Icon: Smile }, { name: "Sparkles", Icon: Sparkles }, { name: "Zap", Icon: Zap },
  { name: "Activity", Icon: Activity }, { name: "Stethoscope", Icon: Stethoscope }, { name: "Pill", Icon: Pill },
  { name: "Bath", Icon: Bath }, { name: "Scissors", Icon: Scissors }, { name: "ThumbsUp", Icon: ThumbsUp },
  { name: "MessageCircle", Icon: MessageCircle }, { name: "Palette", Icon: Palette }, { name: "Apple", Icon: Apple },
  { name: "Utensils", Icon: Utensils }, { name: "BookOpen", Icon: BookOpen }, { name: "Music", Icon: Music },
  { name: "Camera", Icon: Camera }, { name: "Dumbbell", Icon: Dumbbell }, { name: "Leaf", Icon: Leaf },
  { name: "Clock", Icon: Clock }, { name: "GlassWater", Icon: GlassWater },
];

const CUSTOM_COLOR_SCHEMES: { id: string; label: string; bg: string; text: string; border: string; btn: string }[] = [
  { id: "purple", label: "紫", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100", btn: "bg-purple-500" },
  { id: "blue",   label: "青", bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-100",   btn: "bg-blue-500" },
  { id: "green",  label: "緑", bg: "bg-green-50",  text: "text-green-600",  border: "border-green-100",  btn: "bg-green-500" },
  { id: "teal",   label: "水", bg: "bg-teal-50",   text: "text-teal-600",   border: "border-teal-100",   btn: "bg-teal-500" },
  { id: "orange", label: "橙", bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100", btn: "bg-orange-500" },
  { id: "pink",   label: "桃", bg: "bg-pink-50",   text: "text-pink-500",   border: "border-pink-100",   btn: "bg-pink-500" },
  { id: "amber",  label: "黄", bg: "bg-amber-50",  text: "text-amber-600",  border: "border-amber-100",  btn: "bg-amber-500" },
  { id: "red",    label: "赤", bg: "bg-red-50",    text: "text-red-500",    border: "border-red-100",    btn: "bg-red-500" },
];

function getCustomIconComponent(name: string) {
  return CUSTOM_ICON_OPTIONS.find(o => o.name === name)?.Icon ?? Star;
}

function getCustomColorScheme(id: string) {
  return CUSTOM_COLOR_SCHEMES.find(c => c.id === id) ?? CUSTOM_COLOR_SCHEMES[0];
}

const DIALOG_TYPES = new Set([
  "milk", "diaper", "food", "milestone", "sleep", "play",
  "toilet", "meal", "words", "discipline", "school_report",
  "medicine", "hobby", "achievement", "schedule", "school_prep", "growth_note",
  "temp", "symptom", "snack", "bath", "toothbrush", "temperature", "nail_care", "skincare", "clinic",
  "express", "drink",
]);

const BREAST_TIMER_KEY = "we_iku_breast_timer";
const BREAST_TIMER_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function _readSavedBreastTimer() {
  try {
    const saved = localStorage.getItem(BREAST_TIMER_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed.savedAt || Date.now() - new Date(parsed.savedAt).getTime() > BREAST_TIMER_TTL_MS) {
      localStorage.removeItem(BREAST_TIMER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const EXPRESS_TIMER_KEY = "we_iku_express_timer";
const EXPRESS_TIMER_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function _readSavedExpressTimer() {
  try {
    const saved = localStorage.getItem(EXPRESS_TIMER_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed.savedAt || Date.now() - new Date(parsed.savedAt).getTime() > EXPRESS_TIMER_TTL_MS) {
      localStorage.removeItem(EXPRESS_TIMER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function QuickActions() {
  const { mutate, isPending } = useCreateLog();
  const { papaLabel, mamaLabel, getLabel: getUserLabel } = useUserLabels();
  const [, navigate] = useLocation();
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings } = useSettings(familyId);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const [foodEntries, setFoodEntries] = useState<{ name: string; amount: string }[]>([{ name: "", amount: "" }]);
  const [foodNote, setFoodNote] = useState("");
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [foodPickerCat, setFoodPickerCat] = useState<string>("all");
  const [showWakeTimePickers, setShowWakeTimePickers] = useState(false);
  const [showBreastTimerCancelConfirm, setShowBreastTimerCancelConfirm] = useState(false);
  const [showExpressTimerCancelConfirm, setShowExpressTimerCancelConfirm] = useState(false);
  const [milestone, setMilestone] = useState("");

  const [diaperPee, setDiaperPee] = useState(false);
  const [diaperPoop, setDiaperPoop] = useState(false);
  const [diaperOther, setDiaperOther] = useState(false);
  const [poopColor, setPoopColor] = useState("");
  const [poopConsistency, setPoopConsistency] = useState("");

  const [bodyTemp, setBodyTemp] = useState("");
  const [tempValue, setTempValue] = useState(36.5);

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomNote, setSymptomNote] = useState("");

  const [milkStep, setMilkStep] = useState<"type" | "detail">("type");
  const [selectedMilkType, setSelectedMilkType] = useState("");
  const [breastLeftMin, setBreastLeftMin] = useState(0);
  const [breastRightMin, setBreastRightMin] = useState(0);
  const [lastAddedLeft, setLastAddedLeft] = useState(0);
  const [lastAddedRight, setLastAddedRight] = useState(0);
  const [breastTimerRunning, setBreastTimerRunning] = useState<boolean>(() => _readSavedBreastTimer()?.running ?? false);
  const [breastTimerPaused, setBreastTimerPaused] = useState<boolean>(() => _readSavedBreastTimer()?.paused ?? false);
  const [breastTimerSide, setBreastTimerSide] = useState<"left" | "right">(() => _readSavedBreastTimer()?.side ?? "left");
  const [breastTimerStart, setBreastTimerStart] = useState<Date | null>(() => {
    const s = _readSavedBreastTimer();
    return s?.startTime ? new Date(s.startTime) : null;
  });
  const [breastTimerAccMs, setBreastTimerAccMs] = useState<number>(() => _readSavedBreastTimer()?.accMs ?? 0);
  const [breastTimerSec, setBreastTimerSec] = useState<number>(() => {
    const s = _readSavedBreastTimer();
    if (!s) return 0;
    if (s.running && s.startTime) {
      return Math.floor((Date.now() - new Date(s.startTime).getTime() + (s.accMs ?? 0)) / 1000);
    }
    return Math.floor((s.accMs ?? 0) / 1000);
  });
  const [isExpressed, setIsExpressed] = useState(false);
  const [expressedMl, setExpressedMl] = useState(0);
  const [formulaMl, setFormulaMl] = useState(0);
  // 搾乳タイマー: 右・左別々
  const [expressLeftAccSec, setExpressLeftAccSec] = useState(0);
  const [expressRightAccSec, setExpressRightAccSec] = useState(0);
  const [expressLeftSec, setExpressLeftSec] = useState(0);
  const [expressRightSec, setExpressRightSec] = useState(0);
  const [expressActiveSide, setExpressActiveSide] = useState<"left" | "right" | null>(null);
  const [expressSideStartMs, setExpressSideStartMs] = useState<number | null>(null);
  const [expressStep, setExpressStep] = useState<"timer" | "amount">("timer");
  const [expressAmount, setExpressAmount] = useState(0);
  const [expressAlarmMin, setExpressAlarmMin] = useState(0);
  const [expressLeftAlarmFired, setExpressLeftAlarmFired] = useState(false);
  const [expressRightAlarmFired, setExpressRightAlarmFired] = useState(false);
  const [expressManualMode, setExpressManualMode] = useState(false);
  const [expressManualLeftMin, setExpressManualLeftMin] = useState<number | "">("");
  const [expressManualRightMin, setExpressManualRightMin] = useState<number | "">("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [spitUp, setSpitUp] = useState(false);
  const [spitUpAmount, setSpitUpAmount] = useState("");
  const [spitUpTiming, setSpitUpTiming] = useState("");
  const [spitUpNote, setSpitUpNote] = useState("");
  const [sleepStep, setSleepStep] = useState<"main" | "manual" | "active">("main");
  const [sleepStartEditTime, setSleepStartEditTime] = useState("");
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualEndTime, setManualEndTime] = useState("");
  const [manualSleepError, setManualSleepError] = useState("");
  const [manualNoEnd, setManualNoEnd] = useState(false);
  const [sleepQuickStartTime, setSleepQuickStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  });
  const [sleepQuickEndTime, setSleepQuickEndTime] = useState("");
  const [sleepQuickNoEnd, setSleepQuickNoEnd] = useState(false);
  const [sleepShowPicker, setSleepShowPicker] = useState(false);
  const [sleepEditWakeTime, setSleepEditWakeTime] = useState("");
  const [sleepTimerMin, setSleepTimerMin] = useState(0);
  const [sleepSuccessSaving, setSleepSuccessSaving] = useState(false);
  const [sleepSuccessRecorded, setSleepSuccessRecorded] = useState(false);
  const [settlingMethod, setSettlingMethod] = useState<string[]>([]);
  const [settlingMinutes, setSettlingMinutes] = useState(0);
  const [sleepLocation, setSleepLocation] = useState("");

  const [toiletResult, setToiletResult] = useState("");
  const [mealResult, setMealResult] = useState("");
  const [mealMemo, setMealMemo] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [disciplineType, setDisciplineType] = useState("");
  const [disciplineMemo, setDisciplineMemo] = useState("");
  const [schoolReportText, setSchoolReportText] = useState("");
  const [medicineText, setMedicineText] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [medicineDose, setMedicineDose] = useState("");
  const [medicineSuggestions, setMedicineSuggestions] = useState<string[]>([]);

  const [stoolAmount, setStoolAmount] = useState("");
  const [hobbyText, setHobbyText] = useState("");
  const [achievementText, setAchievementText] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [schoolPrepText, setSchoolPrepText] = useState("");
  const [playTypes, setPlayTypes] = useState<string[]>([]);
  const [playMemo, setPlayMemo] = useState("");
  const [milkPerformers, setMilkPerformers] = useState<string[]>(() => {
    const ut = localStorage.getItem("userType") || "papa";
    return [ut];
  });
  const [bathPerformers, setBathPerformers] = useState<string[]>(() => {
    const ut = localStorage.getItem("userType") || "papa";
    return [ut];
  });
  const [showHoldEndInput, setShowHoldEndInput] = useState(false);
  const [holdPerformers, setHoldPerformers] = useState<string[]>(() => {
    const ut = localStorage.getItem("userType") || "papa";
    return [ut];
  });
  const [holdNote, setHoldNote] = useState("");
  const [holdEndTime, setHoldEndTime] = useState("");
  const [multiPerformers, setMultiPerformers] = useState<string[]>(() => {
    const ut = localStorage.getItem("userType") || "papa";
    return [ut];
  });
  const [snackText, setSnackText] = useState("");
  const [drinkType, setDrinkType] = useState("");
  const [drinkCustom, setDrinkCustom] = useState("");
  const [drinkAmount, setDrinkAmount] = useState("");
  const [clinicText, setClinicText] = useState("");
  const [logDateTime, setLogDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  });

  // Arrange mode (home screen drag-to-reorder)
  const [arrangeMode, setArrangeMode] = useState(false);
  const [arrangeOrder, setArrangeOrder] = useState<string[]>([]);
  const [dragActionId, setDragActionId] = useState<string | null>(null);
  const [orderVersion, setOrderVersion] = useState(0);

  const [activeCustomAction, setActiveCustomAction] = useState<{ id: number; label: string; iconName: string; colorScheme: string } | null>(null);
  const [customMemo, setCustomMemo] = useState("");
  const [showAddCustomAction, setShowAddCustomAction] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newCustomIconName, setNewCustomIconName] = useState("Star");
  const [newCustomColorScheme, setNewCustomColorScheme] = useState("purple");

  const { activeChild, activeChildId } = useActiveChild(familyId, settings);
  const { data: activeSession } = useActiveSleepSession(familyId, activeChildId ?? undefined);
  const { data: foodIngredients = [] } = useQuery<{ ingredientName: string; category: string; status: string; isCustom: boolean }[]>({
    queryKey: ["/api/families/:familyId/food-ingredients/:childId", familyId, activeChildId],
    queryFn: async () => {
      if (!activeChildId) return [];
      const res = await fetch(`/api/families/${familyId}/food-ingredients/${activeChildId}`);
      return res.json();
    },
    enabled: !!activeChildId,
  });
  const { data: customQuickActionsData = [] } = useQuery<{ id: number; label: string; iconName: string; colorScheme: string; sortOrder: number }[]>({
    queryKey: ["/api/families/:familyId/custom-quick-actions", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/custom-quick-actions`);
      return res.json();
    },
  });

  const createCustomQuickAction = useMutation({
    mutationFn: async (data: { label: string; iconName: string; colorScheme: string }) => {
      const res = await apiRequest("POST", `/api/families/${familyId}/custom-quick-actions`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families/:familyId/custom-quick-actions", familyId] });
      setShowAddCustomAction(false);
      setNewCustomLabel("");
      setNewCustomIconName("Star");
      setNewCustomColorScheme("purple");
    },
  });

  const deleteCustomQuickAction = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/families/${familyId}/custom-quick-actions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families/:familyId/custom-quick-actions", familyId] });
    },
  });

  const startSleep = useStartSleepSession();
  const endSleep = useEndSleepSession();
  const manualSleep = useManualSleepSession();
  const updateSleepTime = useUpdateSleepTime();

  useEffect(() => {
    if (!activeSession?.id || activeSession.endedAt) return;
    const update = () => {
      const mins = differenceInMinutes(new Date(), new Date(activeSession.startedAt));
      setSleepTimerMin(Math.max(0, mins));
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // 授乳タイマーをlocalStorageに保存（画面を離れても復元できるように）
  // 初期値は lazy initializer で復元済みなので effect は保存のみ担当
  useEffect(() => {
    if (breastTimerRunning || breastTimerPaused) {
      localStorage.setItem(BREAST_TIMER_KEY, JSON.stringify({
        running: breastTimerRunning,
        paused: breastTimerPaused,
        side: breastTimerSide,
        startTime: breastTimerStart?.toISOString() ?? null,
        accMs: breastTimerAccMs,
        savedAt: new Date().toISOString(),
      }));
    } else {
      localStorage.removeItem(BREAST_TIMER_KEY);
    }
  }, [breastTimerRunning, breastTimerPaused, breastTimerSide, breastTimerStart, breastTimerAccMs]);

  useEffect(() => {
    if (!breastTimerRunning || !breastTimerStart) return;
    const interval = setInterval(() => {
      setBreastTimerSec(Math.floor((Date.now() - breastTimerStart.getTime() + breastTimerAccMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [breastTimerRunning, breastTimerStart, breastTimerAccMs]);

  // 搾乳タイマーをlocalStorageに保存（フローティングタイマー表示用）
  useEffect(() => {
    const isActive = expressActiveSide !== null;
    const hasTime = expressLeftAccSec > 0 || expressRightAccSec > 0 || isActive;
    if (hasTime) {
      localStorage.setItem(EXPRESS_TIMER_KEY, JSON.stringify({
        running: isActive,
        paused: !isActive,
        startTime: isActive && expressSideStartMs ? new Date(expressSideStartMs).toISOString() : null,
        accMs: (expressLeftAccSec + expressRightAccSec) * 1000,
        savedAt: new Date().toISOString(),
      }));
    } else {
      localStorage.removeItem(EXPRESS_TIMER_KEY);
    }
  }, [expressActiveSide, expressSideStartMs, expressLeftAccSec, expressRightAccSec]);

  // 搾乳タイマー: アクティブサイドのsecをリアルタイム更新
  useEffect(() => {
    if (expressActiveSide === null || expressSideStartMs === null) return;
    const base = expressActiveSide === "left" ? expressLeftAccSec : expressRightAccSec;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - expressSideStartMs) / 1000);
      if (expressActiveSide === "left") setExpressLeftSec(base + elapsed);
      else setExpressRightSec(base + elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [expressActiveSide, expressSideStartMs, expressLeftAccSec, expressRightAccSec]);

  // AudioContext 初期化（ユーザー操作タイミングで呼ぶ必要あり）
  const warmupAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {}
  }, []);

  const playExpressAlarm = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "closed") return;
      const doPlay = () => {
        const playBeep = (t: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "square";
          osc.frequency.setValueAtTime(660, t);
          gain.gain.setValueAtTime(0.6, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.start(t);
          osc.stop(t + 0.4);
        };
        const now = ctx.currentTime;
        for (let i = 0; i < 5; i++) playBeep(now + i * 0.5);
      };
      if (ctx.state === "suspended") {
        ctx.resume().then(doPlay).catch(() => {});
      } else {
        doPlay();
      }
    } catch {}
  }, []);

  // バックグラウンド復帰時に経過時間を再計算
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && expressActiveSide !== null && expressSideStartMs !== null) {
        const base = expressActiveSide === "left" ? expressLeftAccSec : expressRightAccSec;
        const elapsed = Math.floor((Date.now() - expressSideStartMs) / 1000);
        const newSec = base + elapsed;
        if (expressActiveSide === "left") setExpressLeftSec(newSec);
        else setExpressRightSec(newSec);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [expressActiveSide, expressSideStartMs, expressLeftAccSec, expressRightAccSec]);

  // 搾乳アラーム: 設定時間に達したら音を鳴らす
  useEffect(() => {
    if (expressAlarmMin <= 0) return;
    if (!expressLeftAlarmFired && expressLeftSec >= expressAlarmMin * 60 && expressLeftSec > 0) {
      setExpressLeftAlarmFired(true);
      playExpressAlarm();
    }
    if (!expressRightAlarmFired && expressRightSec >= expressAlarmMin * 60 && expressRightSec > 0) {
      setExpressRightAlarmFired(true);
      playExpressAlarm();
    }
  }, [expressLeftSec, expressRightSec, expressAlarmMin, expressLeftAlarmFired, expressRightAlarmFired, playExpressAlarm]);

  const isSleepTrainingEnabled = activeChild?.sleepTrainingEnabled !== false;

  const birthday = activeChild?.birthday || settings?.babyBirthday;
  const months = birthday ? differenceInMonths(new Date(), parseISO(birthday)) : 0;
  const currentPhase = getPhaseForAge(months);

  const allActionsMap = useMemo(() => getAllActions(), []);

  const phaseActions = useMemo(() => {
    const baseActions = getActionsForPhase(currentPhase);

    if (activeChildId) {
      try {
        const overridesKey = `phase_button_overrides_${activeChildId}`;
        const stored = localStorage.getItem(overridesKey);
        if (stored) {
          const overrides: string[] = JSON.parse(stored);
          if (Array.isArray(overrides) && overrides.length > 0) {
            const seen = new Set<string>();
            const filtered: PhaseActionConfig[] = [];
            for (const id of overrides) {
              if (seen.has(id)) continue;
              seen.add(id);
              const action = baseActions.find(a => a.id === id) || allActionsMap.get(id);
              if (action) filtered.push(action);
            }
            if (filtered.length > 0) return filtered;
          }
        }
      } catch {}
    }

    return baseActions;
  }, [currentPhase, activeChildId, allActionsMap, orderVersion]);

  const actions = phaseActions.map((action, idx) => {
    if (action.id === "sleep") {
      const isSleeping = activeSession?.id && !activeSession.endedAt;
      return {
        ...action,
        label: isSleeping ? "起きた" : action.label,
        icon: isSleeping ? Sun : action.icon,
        color: isSleeping
          ? "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
          : action.color,
        delay: idx * 0.05,
      };
    }
    return { ...action, delay: idx * 0.05 };
  });

  // Arrange mode: displayed list (live reorder preview)
  const displayedActions = useMemo(() => {
    if (!arrangeMode || arrangeOrder.length === 0) return actions;
    return arrangeOrder
      .map(id => actions.find(a => a.id === id))
      .filter(Boolean) as typeof actions;
  }, [arrangeMode, arrangeOrder, actions]);


  const enterArrangeMode = () => {
    setArrangeMode(true);
    setArrangeOrder(actions.map(a => a.id));
  };

  const exitArrangeMode = () => {
    if (activeChildId && arrangeOrder.length > 0) {
      localStorage.setItem(`phase_button_overrides_${activeChildId}`, JSON.stringify(arrangeOrder));
      setOrderVersion(v => v + 1);
    }
    setArrangeMode(false);
    setArrangeOrder([]);
    setDragActionId(null);
  };

  const onGripPointerDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragActionId(id);
  };

  const onGripPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragActionId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el?.closest("[data-arrange-id]") as HTMLElement | null;
    if (btn?.dataset.arrangeId && btn.dataset.arrangeId !== dragActionId) {
      const targetId = btn.dataset.arrangeId;
      setArrangeOrder(prev => {
        const newOrder = [...prev];
        const from = newOrder.indexOf(dragActionId);
        const to = newOrder.indexOf(targetId);
        if (from !== -1 && to !== -1 && from !== to) {
          newOrder.splice(from, 1);
          newOrder.splice(to, 0, dragActionId);
        }
        return newOrder;
      });
    }
  };

  const onGripPointerUp = () => {
    setDragActionId(null);
  };

  const resetDiaper = () => {
    setDiaperPee(false);
    setDiaperPoop(false);
    setDiaperOther(false);
    setPoopColor("");
    setPoopConsistency("");
    setStoolAmount("");
  };

  const resetMilk = (force = false) => {
    setMilkStep("type");
    setSelectedMilkType("");
    setMilkPerformers([localStorage.getItem("userType") || "papa"]);
    setBreastLeftMin(0);
    setBreastRightMin(0);
    setLastAddedLeft(0);
    setLastAddedRight(0);
    // タイマー実行中/一時停止中は強制リセット時のみリセット
    if (force || (!breastTimerRunning && !breastTimerPaused)) {
      setBreastTimerRunning(false);
      setBreastTimerPaused(false);
      setBreastTimerStart(null);
      setBreastTimerSec(0);
      setBreastTimerAccMs(0);
      if (force) localStorage.removeItem(BREAST_TIMER_KEY);
    }
    setIsExpressed(false);
    setExpressedMl(0);
    setFormulaMl(0);
    setSpitUp(false);
    setSpitUpAmount("");
    setSpitUpTiming("");
    setSpitUpNote("");
  };

  const resetNewDialogs = () => {
    setToiletResult("");
    setMealResult("");
    setMealMemo("");
    setWordsText("");
    setDisciplineType("");
    setDisciplineMemo("");
    setSchoolReportText("");
    setMedicineText("");
    setMedicineName("");
    setMedicineDose("");
    setStoolAmount("");
    setHobbyText("");
    setAchievementText("");
    setScheduleText("");
    setSchoolPrepText("");
    setPlayTypes([]);
    setPlayMemo("");
    setBathPerformers([localStorage.getItem("userType") || "papa"]);
    setHoldPerformers([localStorage.getItem("userType") || "papa"]);
    setHoldNote("");
    setHoldEndTime("");
    setShowHoldEndInput(false);
    setMultiPerformers([localStorage.getItem("userType") || "papa"]);
    setSnackText("");
    setDrinkType("");
    setDrinkCustom("");
    setDrinkAmount("");
    setClinicText("");
    // 搾乳タイマー動作中はリセットしない
    if (expressActiveSide === null && expressLeftAccSec === 0 && expressRightAccSec === 0) {
      setExpressStep("timer");
    }
    setExpressAmount(0);
  };

  const resetExpressTimer = (force = false) => {
    const hasTime = expressLeftAccSec > 0 || expressRightAccSec > 0 || expressActiveSide !== null;
    if (force || !hasTime) {
      setExpressLeftAccSec(0);
      setExpressRightAccSec(0);
      setExpressLeftSec(0);
      setExpressRightSec(0);
      setExpressActiveSide(null);
      setExpressSideStartMs(null);
      setExpressStep("timer");
      setExpressLeftAlarmFired(false);
      setExpressRightAlarmFired(false);
      setExpressManualMode(false);
      setExpressManualLeftMin("");
      setExpressManualRightMin("");
      localStorage.removeItem(EXPRESS_TIMER_KEY);
    }
    setExpressAmount(0);
  };

  const getCreatedAtFromDateTime = () => {
    const d = new Date(logDateTime);
    if (!isNaN(d.getTime())) return d.toISOString();
    return undefined;
  };

  const [showDateTimeInput, setShowDateTimeInput] = useState(false);
  const userType = localStorage.getItem("userType") || "papa";
  const hasFamilyPair = familyId !== "default";
  const perfBy = multiPerformers.length > 0 ? multiPerformers.join("・") : userType;

  const multiPerformerSelectorJsx = hasFamilyPair ? (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-500">担当者（複数選択可）</p>
      <div className="grid grid-cols-3 gap-2">
        {(["mama", "papa", "other"] as const).map((role) => {
          const selected = multiPerformers.includes(role);
          const label = role === "mama" ? mamaLabel : role === "papa" ? papaLabel : "その他";
          const colors = role === "mama"
            ? selected ? "bg-pink-500 border-pink-500 text-white" : "bg-white border-gray-100 text-gray-500"
            : role === "papa"
            ? selected ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-100 text-gray-500"
            : selected ? "bg-gray-500 border-gray-500 text-white" : "bg-white border-gray-100 text-gray-500";
          return (
            <button
              key={role}
              type="button"
              data-testid={`button-performer-${role}`}
              onClick={() => setMultiPerformers(prev => {
                if (prev.includes(role)) {
                  return prev.length === 1 ? prev : prev.filter(r => r !== role);
                }
                return [...prev, role];
              })}
              className={`py-3 rounded-2xl text-sm font-black border-2 transition-colors ${colors}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const dateTimePickerJsx = (
    <div className="px-1">
      {showDateTimeInput ? (
        <DateTimeClock value={logDateTime} onChange={setLogDateTime} />
      ) : (
        <button
          type="button"
          data-testid="button-show-datetime"
          onClick={() => setShowDateTimeInput(true)}
          className="flex items-center gap-1.5 text-xs text-gray-400 font-bold py-1"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{format(new Date(logDateTime), "H:mm")}</span>
          <span className="text-[10px] text-purple-400 ml-1">時間を変更</span>
        </button>
      )}
    </div>
  );

  const handleMilkSubmit = () => {
    const mType = selectedMilkType;
    const totalBreastMin = breastLeftMin + breastRightMin;
    const totalMl = (isExpressed ? expressedMl : 0) + formulaMl;

    let msgParts: string[] = [];
    if (mType === "breast" || mType === "mixed") {
      if (totalBreastMin > 0) {
        msgParts.push(`母乳 左${breastLeftMin}分/右${breastRightMin}分`);
      }
      if (isExpressed && expressedMl > 0) {
        msgParts.push(`搾乳 ${expressedMl}ml`);
      }
    }
    if (mType === "formula" || mType === "mixed") {
      msgParts.push(`ミルク ${formulaMl}ml`);
    }

    const typeLabel = mType === "breast" ? "母乳" : mType === "formula" ? "ミルク" : "混合";
    const detailStr = msgParts.join(" / ");
    const msg = detailStr ? `${typeLabel}を記録しました！ ${detailStr}` : `${typeLabel}を記録しました！`;

    const logData: any = {
      type: "milk",
      subType: mType,
      message: msg,
      breastLeftMin: (mType === "breast" || mType === "mixed") ? breastLeftMin : null,
      breastRightMin: (mType === "breast" || mType === "mixed") ? breastRightMin : null,
      isExpressed: (mType === "breast" || mType === "mixed") ? isExpressed : false,
      expressedMl: (mType === "breast" || mType === "mixed") && isExpressed ? expressedMl : null,
      formulaMl: (mType === "formula" || mType === "mixed") ? formulaMl : null,
      spitUp,
      spitUpAmount: spitUp ? spitUpAmount : null,
      spitUpTiming: spitUp ? spitUpTiming : null,
      spitUpNote: spitUp && spitUpNote.trim() ? spitUpNote.trim() : null,
      performedBy: milkPerformers.join("・"),
    };
    const ca = getCreatedAtFromDateTime();
    if (ca) logData.createdAt = ca;
    mutate(logData);
    resetMilk();
    setActiveDialog(null);
  };

  const handleAction = (type: string, subType?: string, label?: string) => {
    let msg = label ? `${label}を記録しました！` : "クイックログ";
    const ca = getCreatedAtFromDateTime();

    if (type === "food") {
      const validEntries = foodEntries.filter(e => e.name.trim() || e.amount);
      const foodItemsJson = JSON.stringify(validEntries);
      const allNames = validEntries.map(e => e.name).filter(Boolean).join("、");
      const foodAmountSummary = validEntries.length === 1
        ? (validEntries[0].amount || "記録")
        : `${validEntries.length}品`;
      msg = `${allNames || '離乳食'}を記録しました！`;
      mutate({
        type,
        message: msg,
        foodItems: foodItemsJson,
        foodAmount: foodAmountSummary,
        foodNote: foodNote.trim() || undefined,
        performedBy: perfBy,
        ...(ca && { createdAt: ca }),
      });
      setFoodEntries([{ name: "", amount: "" }]);
      setFoodNote("");
    } else if (type === "milestone") {
      mutate({
        type: "milestone",
        message: milestone || "はじめての記念日！",
        performedBy: perfBy,
        ...(ca && { createdAt: ca }),
      });
      setMilestone("");
    } else if (type === "diaper") {
      const dType = diaperPee && diaperPoop ? "both" : diaperPoop ? "poop" : "pee";
      const colorLabel = poopColor ? POOP_COLORS.find(c => c.id === poopColor)?.label : "";
      const consistLabel = poopConsistency ? POOP_CONSISTENCY.find(c => c.id === poopConsistency)?.label : "";
      const stoolAmountLabel = stoolAmount ? STOOL_AMOUNTS.find(s => s.id === stoolAmount)?.label : "";

      if (diaperPoop) {
        const details = [colorLabel, consistLabel, stoolAmountLabel].filter(Boolean).join("・");
        const label = diaperPee ? "両方" : "うんち";
        msg = `${label}を記録しました！${details ? `(${details})` : ""}`;
      } else {
        msg = "おしっこを記録しました！";
      }

      mutate({
        type: "diaper",
        subType: dType,
        message: msg,
        poopColor: diaperPoop ? poopColor || null : null,
        poopConsistency: diaperPoop ? poopConsistency || null : null,
        stoolType: diaperPoop ? poopConsistency || null : null,
        stoolAmount: diaperPoop ? stoolAmount || null : null,
        stoolColor: diaperPoop ? poopColor || null : null,
        performedBy: perfBy,
        ...(ca && { createdAt: ca }),
      });
      resetDiaper();
    } else if (type === "toilet") {
      const resultLabel = toiletResult === "success" ? "成功" : toiletResult === "fail" ? "失敗" : "誘った";
      msg = `トイレ: ${resultLabel}`;
      mutate({ type: "toilet", subType: toiletResult, message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setToiletResult("");
    } else if (type === "meal") {
      const mealLabelMap: Record<string, string> = { complete: "完食", mostly: "8割", twoThirds: "2/3", half: "半分", third: "1/3", little: "少し", refused: "イヤイヤ" };
      const resultLabel = mealLabelMap[mealResult] ?? mealResult;
      msg = `ごはん: ${resultLabel}${mealMemo ? ` (${mealMemo})` : ""}`;
      mutate({ type: "meal", subType: mealResult, message: msg, foodItems: mealMemo || null, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setMealResult("");
      setMealMemo("");
    } else if (type === "words") {
      msg = wordsText;
      mutate({ type: "words", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setWordsText("");
    } else if (type === "discipline") {
      const resultLabel = disciplineType === "praise" ? "褒めた" : "叱った";
      msg = `しつけ: ${resultLabel}${disciplineMemo ? ` - ${disciplineMemo}` : ""}`;
      mutate({ type: "discipline", subType: disciplineType, message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setDisciplineType("");
      setDisciplineMemo("");
    } else if (type === "school_report") {
      msg = `園の記録: ${schoolReportText}`;
      mutate({ type: "school_report", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setSchoolReportText("");
    } else if (type === "medicine") {
      const parts = [medicineName, medicineDose, medicineText].filter(Boolean);
      msg = `おくすり: ${parts.join(" ")}`;
      mutate({
        type: "medicine",
        message: msg,
        medicineName: medicineName || null,
        medicineDose: medicineDose || null,
        performedBy: perfBy,
        ...(ca && { createdAt: ca }),
      });
      setMedicineText("");
      setMedicineName("");
      setMedicineDose("");
    } else if (type === "hobby") {
      msg = `きょうみ: ${hobbyText}`;
      mutate({ type: "hobby", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setHobbyText("");
    } else if (type === "achievement") {
      msg = `できた!: ${achievementText}`;
      mutate({ type: "achievement", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setAchievementText("");
    } else if (type === "schedule") {
      msg = `よてい: ${scheduleText}`;
      mutate({ type: "schedule", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setScheduleText("");
    } else if (type === "school_prep") {
      msg = `入学準備: ${schoolPrepText}`;
      mutate({ type: "school_prep", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setSchoolPrepText("");
    } else if (type === "play") {
      const typeLabels = playTypes.map(id => PLAY_OPTIONS.find(o => o.id === id)?.label || id).join("・");
      msg = `あそび: ${typeLabels}${playMemo ? ` - ${playMemo}` : ""}`;
      mutate({ type: "play", subType: playTypes.join("・"), message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setPlayTypes([]);
      setPlayMemo("");
    } else if (type === "snack") {
      msg = snackText.trim() ? `おやつ: ${snackText}` : "おやつを食べました";
      mutate({ type: "snack", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setSnackText("");
    } else if (type === "drink") {
      const dName = drinkType === "その他" ? (drinkCustom || "飲み物") : drinkType;
      const amtPart = drinkAmount ? ` (${drinkAmount}ml)` : "";
      msg = `${dName}を飲みました${amtPart}`;
      mutate({ type: "drink", subType: dName, message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setDrinkType("");
      setDrinkCustom("");
      setDrinkAmount("");
    } else if (type === "temperature") {
      mutate({ type: "temperature", bodyTemperature: tempValue, message: `体温: ${tempValue.toFixed(1)}°C`, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setTempValue(36.5);
    } else if (type === "clinic") {
      msg = `通院: ${clinicText || "病院に行きました"}`;
      mutate({ type: "clinic", message: msg, performedBy: perfBy, ...(ca && { createdAt: ca }) });
      setClinicText("");
    } else if (type === "nail_care") {
      const nailStr = multiPerformers.join("・");
      const nailLabel = multiPerformers.map(getUserLabel).join("・");
      const nailMsg = `${nailLabel}で爪切りをしました！`;
      mutate({ type: "nail_care", message: nailMsg, performedBy: nailStr, ...(ca && { createdAt: ca }) });
    } else if (type === "skincare") {
      const skincareStr = multiPerformers.join("・");
      const skincareLabel = multiPerformers.map(getUserLabel).join("・");
      const skincareMsg = `${skincareLabel}で保湿をしました！`;
      mutate({ type: "skincare", message: skincareMsg, performedBy: skincareStr, ...(ca && { createdAt: ca }) });
    } else if (type === "bath") {
      const bathPerformerStr = bathPerformers.join("・");
      const bathLabel = bathPerformers.map(getUserLabel).join("・");
      const bathMsg = `${bathLabel}でおふろに入れました！`;
      mutate({ type: "bath", message: bathMsg, performedBy: bathPerformerStr, ...(ca && { createdAt: ca }) });
    } else if (type === "hold") {
      const holdPerformerStr = holdPerformers.join("・");
      const holdLabel = holdPerformers.map(getUserLabel).join("・");
      const holdEndAt = holdEndTime ? new Date(holdEndTime) : null;
      const startD = ca ? new Date(ca) : new Date();
      let durationNote = "";
      if (holdEndAt) {
        const mins = Math.round((holdEndAt.getTime() - startD.getTime()) / 60000);
        if (mins > 0) durationNote = ` (${mins}分間)`;
      }
      const noteStr = holdNote.trim() ? ` — ${holdNote.trim()}` : "";
      const holdMsg = `${holdLabel}が抱っこしました${durationNote}${noteStr}`;
      mutate({
        type: "hold",
        message: holdMsg,
        performedBy: holdPerformerStr,
        ...(ca && { createdAt: ca }),
        ...(holdEndAt && { holdEndAt: holdEndAt.toISOString() }),
      });
    } else if (type === "toothbrush") {
      const brushStr = multiPerformers.join("・");
      const brushLabel = multiPerformers.map(getUserLabel).join("・");
      const brushMsg = `${brushLabel}ではみがきをしました！`;
      mutate({ type: "toothbrush", message: brushMsg, performedBy: brushStr, ...(ca && { createdAt: ca }) });
    } else {
      mutate({
        type,
        subType: subType || null,
        message: msg,
        performedBy: perfBy,
        ...(ca && { createdAt: ca }),
      });
    }
    setActiveDialog(null);
  };


  const openDialog = (id: string) => {
    if (id === "diaper") resetDiaper();
    if (id === "milk") resetMilk();
    resetNewDialogs();
    setShowDateTimeInput(false);
    const now = new Date();
    now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
    setLogDateTime(format(now, "yyyy-MM-dd'T'HH:mm"));
    if (id === "medicine") {
      fetch(`/api/families/${familyId}/medicine-names`)
        .then(r => r.json())
        .then(names => setMedicineSuggestions(names))
        .catch(() => {});
    }
    setActiveDialog(id);
  };

  const getDialogTitle = () => {
    if (activeDialog === "milk" && milkStep === "detail") {
      return selectedMilkType === "breast" ? "母乳の記録" : selectedMilkType === "formula" ? "ミルクの記録" : "混合の記録";
    }
    if (activeDialog === "sleep" && sleepStep === "manual") return "ねんねの手入力";
    if (activeDialog === "sleep" && sleepStep === "active") return "ねんね中";
    if (activeDialog === "sleep") return "ねんねの記録";
    if (activeDialog === "toilet") return "トイレの記録";
    if (activeDialog === "meal") return "ごはんの記録";
    if (activeDialog === "words") return "ことばの記録";
    if (activeDialog === "discipline") return "しつけの記録";
    if (activeDialog === "school_report") return "園の記録";
    if (activeDialog === "medicine") return "おくすりの記録";
    if (activeDialog === "hobby") return "きょうみの記録";
    if (activeDialog === "achievement") return "できた!の記録";
    if (activeDialog === "schedule") return "よていの記録";
    if (activeDialog === "school_prep") return "入学準備の記録";
    if (activeDialog === "play") return "あそびの記録";
    if (activeDialog === "snack") return "おやつの記録";
    if (activeDialog === "drink") return "のみものの記録";
    if (activeDialog === "bath") return "おふろの記録";
    if (activeDialog === "hold") return "抱っこの記録";
    if (activeDialog === "toothbrush") return "はみがきの記録";
    if (activeDialog === "nail_care") return "爪切りの記録";
    if (activeDialog === "skincare") return "保湿の記録";
    if (activeDialog === "clinic") return "通院の記録";
    if (activeDialog === "temperature") return "たいおんの記録";
    if (activeDialog === "express") return "搾乳の記録";
    return actions.find(a => a.id === activeDialog)?.label;
  };

  // 寝かしつけ方法・場所・時間の任意選択UI（クライアント要望 2026-09-10、originwebapp移植）
  const sleepDetailSelectorJsx = (
    <div className="space-y-3">
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
              data-testid={`button-qa-sleep-method-${m}`}
              onClick={() => {
                if (m === "なし") {
                  setSettlingMethod(settlingMethod.includes("なし") ? [] : ["なし"]);
                } else {
                  setSettlingMethod(prev =>
                    prev.includes(m) ? prev.filter(x => x !== m) : [...prev.filter(x => x !== "なし"), m]
                  );
                }
              }}
              className={cn(
                "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                settlingMethod.includes(m)
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
          {["布団", "抱っこ寝", "抱っこひも寝", "ベビーカー", "チャイルドシート"].map((loc) => (
            <button
              key={loc}
              type="button"
              data-testid={`button-qa-sleep-location-${loc}`}
              onClick={() => setSleepLocation(sleepLocation === loc ? "" : loc)}
              className={cn(
                "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                sleepLocation === loc
                  ? "bg-sky-500 border-sky-500 text-white"
                  : "bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-sky-500"
              )}
            >{loc}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
          <Timer className="w-3 h-3" />
          寝かしつけにかかった時間（任意）
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[5, 10, 15, 30, 45, 60].map((min) => (
            <button
              key={min}
              type="button"
              data-testid={`button-qa-settling-minutes-${min}`}
              onClick={() => setSettlingMinutes(settlingMinutes === min ? 0 : min)}
              className={cn(
                "px-3 h-8 rounded-xl text-xs font-bold border-2 transition-colors",
                settlingMinutes === min
                  ? "bg-purple-500 border-purple-500 text-white"
                  : "bg-white dark:bg-gray-800 border-purple-100 dark:border-purple-800 text-purple-500"
              )}
            >{min}分</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* 授乳タイマー実行中バナー */}
      {(breastTimerRunning || breastTimerPaused) && (
        <button
          data-testid="banner-breast-timer-running"
          onClick={() => {
            setSelectedMilkType("breast");
            setMilkStep("detail");
            const now = new Date();
            now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
            setLogDateTime(format(now, "yyyy-MM-dd'T'HH:mm"));
            setActiveDialog("milk");
          }}
          className={`w-full flex items-center justify-between px-5 py-3 rounded-2xl border-2 transition-all ${
            breastTimerPaused
              ? "bg-gray-50 border-gray-200 text-gray-600"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${breastTimerPaused ? "bg-gray-400" : "bg-rose-400 animate-pulse"}`} />
            <span className="text-xs font-black">
              {breastTimerPaused ? "授乳タイマー（一時停止中）" : "授乳中"}
            </span>
          </div>
          <span className="text-xl font-black tabular-nums">
            {String(Math.floor(breastTimerSec / 60)).padStart(2, "0")}:{String(breastTimerSec % 60).padStart(2, "0")}
          </span>
        </button>
      )}
    <div className="px-6">
      {/* Arrange mode toggle */}
      <div className="flex justify-end mb-2">
        {arrangeMode ? (
          <button
            data-testid="button-arrange-done"
            onClick={exitArrangeMode}
            className="flex items-center gap-1.5 text-xs font-black text-white bg-purple-500 px-3 py-1.5 rounded-full shadow"
          >
            <Check className="w-3.5 h-3.5" />
            完了
          </button>
        ) : (
          <button
            data-testid="button-arrange-start"
            onClick={enterArrangeMode}
            className="flex items-center gap-1 text-xs font-bold text-gray-400"
          >
            <GripVertical className="w-3.5 h-3.5" />
            並び替え
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
      {displayedActions.map((action) => (
        <div
          key={action.id}
          data-arrange-id={action.id}
          className="relative"
        >
          {arrangeMode && (
            <div
              className="absolute inset-0 z-10 touch-none cursor-grab active:cursor-grabbing rounded-[2rem]"
              onPointerDown={(e) => onGripPointerDown(e, action.id)}
              onPointerMove={onGripPointerMove}
              onPointerUp={onGripPointerUp}
              onPointerCancel={onGripPointerUp}
            />
          )}
          <motion.button
            key={action.id}
            data-testid={`button-action-${action.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: dragActionId === action.id ? 0.4 : 1,
              y: 0,
              scale: dragActionId === action.id ? 0.95 : 1,
            }}
            transition={{ delay: arrangeMode ? 0 : action.delay }}
            whileHover={arrangeMode ? {} : { scale: 1.05, y: -2 }}
            whileTap={arrangeMode ? {} : { scale: 0.95 }}
            onClick={() => {
              if (arrangeMode) return;
              if (action.id === "sleep") {
                if (activeSession?.id && !activeSession.endedAt) {
                  setSleepStartEditTime(format(new Date(activeSession.startedAt), "yyyy-MM-dd'T'HH:mm"));
                  setSleepStep("active");
                  setShowWakeTimePickers(false);
                  openDialog("sleep");
                  return;
                }
                setSleepSuccessRecorded(false);
                const now = new Date();
                now.setSeconds(0, 0);
                now.setMinutes(Math.round(now.getMinutes() / 5) * 5);
                setSleepQuickStartTime(format(now, "yyyy-MM-dd'T'HH:mm"));
                setSleepShowPicker(false);
                setSleepStep("main");
                openDialog("sleep");
              } else if (action.id === "breast" || action.id === "formula") {
                if (action.id === "breast" && (breastTimerRunning || breastTimerPaused)) {
                  const now = new Date();
                  now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
                  setLogDateTime(format(now, "yyyy-MM-dd'T'HH:mm"));
                  setSelectedMilkType("breast");
                  setMilkStep("detail");
                  setActiveDialog("milk");
                } else {
                  openDialog("milk");
                  setSelectedMilkType(action.id);
                  setMilkStep("detail");
                }
              } else if (DIALOG_TYPES.has(action.dialogType)) {
                openDialog(action.id);
              } else {
                handleAction(action.id);
              }
            }}
            disabled={!arrangeMode && (isPending || endSleep.isPending || startSleep.isPending)}
            className={`
              w-full flex flex-col items-center justify-center gap-2 py-4 px-2
              rounded-[2rem] border-2 shadow-sm transition-all duration-200
              ${action.color}
              ${arrangeMode ? "cursor-grab" : ""}
            `}
          >
            <div className="bg-white/95 dark:bg-white/18 p-2.5 rounded-full shadow-sm">
              {!arrangeMode && (isPending || endSleep.isPending || startSleep.isPending) && action.id === "sleep" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : arrangeMode ? (
                <GripVertical className="w-5 h-5 stroke-[2px] text-gray-400" />
              ) : (
                <action.icon className="w-5 h-5 stroke-[2.5px]" />
              )}
            </div>
            <span className="font-bold text-xs tracking-wide">{action.label}</span>
            {!arrangeMode && action.id === "sleep" && activeSession?.id && !activeSession.endedAt && (
              <span className="text-[9px] font-black text-purple-600 -mt-1" data-testid="text-sleep-timer-mini">
                {sleepTimerMin}分
              </span>
            )}
          </motion.button>
        </div>
      ))}
      </div>{/* end grid */}

      {/* カスタムクイックログボタン */}
      {(customQuickActionsData.length > 0 || arrangeMode) && (
        <div className="mt-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">カスタム</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {customQuickActionsData.map((cqa) => {
              const scheme = getCustomColorScheme(cqa.colorScheme);
              const IconComp = getCustomIconComponent(cqa.iconName);
              return (
                <div key={cqa.id} className="relative">
                  {arrangeMode && (
                    <button
                      data-testid={`button-delete-custom-${cqa.id}`}
                      onClick={() => deleteCustomQuickAction.mutate(cqa.id)}
                      className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <motion.button
                    data-testid={`button-action-custom-${cqa.id}`}
                    whileHover={arrangeMode ? {} : { scale: 1.05, y: -2 }}
                    whileTap={arrangeMode ? {} : { scale: 0.95 }}
                    onClick={() => {
                      if (arrangeMode) return;
                      const now = new Date();
                      now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);
                      setLogDateTime(format(now, "yyyy-MM-dd'T'HH:mm"));
                      setMultiPerformers([localStorage.getItem("userType") || "papa"]);
                      setCustomMemo("");
                      setActiveCustomAction(cqa);
                    }}
                    className={`w-full flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-[2rem] border-2 shadow-sm transition-all duration-200 ${scheme.bg} ${scheme.text} ${scheme.border} hover:opacity-90`}
                  >
                    <div className="bg-white/95 dark:bg-white/18 p-2.5 rounded-full shadow-sm">
                      <IconComp className="w-5 h-5 stroke-[2.5px]" />
                    </div>
                    <span className="font-bold text-xs tracking-wide">{cqa.label}</span>
                  </motion.button>
                </div>
              );
            })}
            {arrangeMode && customQuickActionsData.length < 10 && (
              <motion.button
                data-testid="button-add-custom-action"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddCustomAction(true)}
                className="w-full flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-[2rem] border-2 border-dashed border-gray-300 text-gray-400 shadow-sm transition-all duration-200 hover:border-purple-300 hover:text-purple-400"
              >
                <div className="bg-gray-50 p-2.5 rounded-full shadow-sm">
                  <Plus className="w-5 h-5 stroke-[2.5px]" />
                </div>
                <span className="font-bold text-xs tracking-wide">追加</span>
              </motion.button>
            )}
          </div>
        </div>
      )}


    </div>{/* end px-6 */}

      <Dialog open={!!activeDialog} onOpenChange={(open) => {
        if (!open && activeDialog === "milk" && (breastTimerRunning || breastTimerPaused)) {
          setShowBreastTimerCancelConfirm(true);
          return;
        }
        if (!open && activeDialog === "express" && expressActiveSide !== null) {
          setShowExpressTimerCancelConfirm(true);
          return;
        }
        setActiveDialog(null); resetDiaper(); resetMilk(); resetNewDialogs(); setSleepStep("main"); setShowDateTimeInput(false); setSettlingMethod([]); setSettlingMinutes(0); setSleepLocation(""); setSleepSuccessRecorded(false); setFoodNote(""); setFoodEntries([{ name: "", amount: "" }]); setShowWakeTimePickers(false); setPlayTypes([]); setPlayMemo("");
      }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none max-h-[80vh] overflow-y-auto top-[45%] sm:top-[50%]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              {getDialogTitle()}
            </DialogTitle>
          </DialogHeader>

          {activeDialog === "sleep" && sleepStep === "main" ? (
            <div className="space-y-3 py-4">
              {sleepDetailSelectorJsx}
              {!sleepShowPicker ? (
                <>
                  {/* 選択画面: 2ボタン */}
                  <Button
                    data-testid="button-sleep-now"
                    onClick={async () => {
                      const userId = localStorage.getItem("userType") || "papa";
                      const startedAtIso = new Date().toISOString();
                      setSleepSuccessSaving(true);
                      try {
                        const res = await fetch("/api/sleep-success", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            familyId,
                            userId,
                            childId: activeChildId ?? null,
                            elapsedMinutes: 0,
                            startedAt: startedAtIso,
                            ...(settlingMethod.length > 0 ? { settlingMethod: settlingMethod.join("・") } : {}),
                            ...(settlingMinutes > 0 ? { settlingMinutes } : {}),
                            ...(sleepLocation ? { sleepLocation } : {}),
                          }),
                        });
                        if (!res.ok) throw new Error("Failed");
                        setActiveDialog(null);
                        setSleepStep("main");
                        setSettlingMethod([]); setSettlingMinutes(0); setSleepLocation("");
                        queryClient.invalidateQueries({ queryKey: ["/api/sleep-sessions/:familyId/active"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/sleep-sessions/:familyId"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
                      } catch {
                        // fail silently
                      } finally {
                        setSleepSuccessSaving(false);
                      }
                    }}
                    disabled={sleepSuccessSaving}
                    className="w-full h-16 rounded-[20px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-lg shadow-lg shadow-indigo-200"
                  >
                    {sleepSuccessSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Moon className="w-6 h-6 mr-2" />
                    )}
                    今すぐ記録する
                  </Button>

                  <Button
                    data-testid="button-sleep-pick-time"
                    variant="outline"
                    onClick={() => {
                      const now = new Date();
                      now.setSeconds(0, 0);
                      now.setMinutes(Math.round(now.getMinutes() / 5) * 5);
                      setSleepQuickStartTime(format(now, "yyyy-MM-dd'T'HH:mm"));
                      setSleepShowPicker(true);
                    }}
                    className="w-full h-12 rounded-[20px] border-2 border-indigo-200 text-indigo-600 dark:border-indigo-700 dark:text-indigo-300 font-bold text-base"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    時刻を指定して記録
                  </Button>
                </>
              ) : (
                <>
                  {/* 時刻ピッカー画面 */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5" />
                      入眠日時
                    </label>
                    <ScrollDateTimePicker
                      value={sleepQuickStartTime}
                      onChange={setSleepQuickStartTime}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                        <Sun className="w-3.5 h-3.5" />
                        起床日時
                      </label>
                      <button
                        type="button"
                        onClick={() => { setSleepQuickNoEnd(v => !v); setSleepQuickEndTime(""); }}
                        className={cn(
                          "text-[11px] font-bold px-2.5 py-1 rounded-xl border-2 transition-colors",
                          sleepQuickNoEnd
                            ? "bg-indigo-100 border-indigo-300 text-indigo-600"
                            : "bg-white border-gray-200 text-gray-400"
                        )}
                      >
                        {sleepQuickNoEnd ? "まだ起きていない" : "入力しない"}
                      </button>
                    </div>
                    {!sleepQuickNoEnd && (
                      <ScrollDateTimePicker
                        value={sleepQuickEndTime}
                        onChange={setSleepQuickEndTime}
                        daysAfter={1}
                      />
                    )}
                    {sleepQuickNoEnd && (
                      <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                        <p className="text-xs font-bold text-indigo-500">ねんね開始として記録します。起きたらタイマーを止めてください。</p>
                      </div>
                    )}
                  </div>

                  {!sleepQuickNoEnd && (() => {
                    const start = sleepQuickStartTime ? new Date(sleepQuickStartTime) : null;
                    const end = sleepQuickEndTime ? new Date(sleepQuickEndTime) : null;
                    const dur = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
                    return dur > 0 ? (
                      <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                        <p className="text-sm font-black text-indigo-700">
                          {Math.floor(dur / 60) > 0 ? `${Math.floor(dur / 60)}時間` : ""}{dur % 60}分のねんね
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setSleepShowPicker(false); setSleepQuickNoEnd(false); setSleepQuickEndTime(""); }}
                      className="h-12 rounded-2xl border-2 font-bold px-4"
                      data-testid="button-sleep-picker-back"
                    >
                      戻る
                    </Button>
                    <Button
                      data-testid="button-sleep-success"
                      onClick={async () => {
                        const userId = localStorage.getItem("userType") || "papa";
                        const customStart = sleepQuickStartTime ? new Date(sleepQuickStartTime) : new Date();
                        const startedAtIso = !isNaN(customStart.getTime()) ? customStart.toISOString() : new Date().toISOString();

                        if (!sleepQuickNoEnd && sleepQuickEndTime) {
                          const end = new Date(sleepQuickEndTime);
                          if (end <= customStart) return;
                          const durationMin = Math.round((end.getTime() - customStart.getTime()) / 60000);
                          manualSleep.mutate({
                            familyId,
                            createdBy: userId,
                            durationMin,
                            startedAt: startedAtIso,
                            childId: activeChildId ?? undefined,
                          });
                          setSleepShowPicker(false);
                          setSleepQuickNoEnd(false);
                          setSleepQuickEndTime("");
                          setActiveDialog(null);
                          setSleepStep("main");
                        } else {
                          setSleepSuccessSaving(true);
                          try {
                            const res = await fetch("/api/sleep-success", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                familyId,
                                userId,
                                childId: activeChildId ?? null,
                                elapsedMinutes: 0,
                                startedAt: startedAtIso,
                              }),
                            });
                            if (!res.ok) throw new Error("Failed");
                            setSleepShowPicker(false);
                            setSleepQuickNoEnd(false);
                            setSleepQuickEndTime("");
                            setActiveDialog(null);
                            setSleepStep("main");
                            queryClient.invalidateQueries({ queryKey: ["/api/sleep-sessions/:familyId/active"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/sleep-sessions/:familyId"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
                          } catch {
                            // fail silently
                          } finally {
                            setSleepSuccessSaving(false);
                          }
                        }
                      }}
                      disabled={sleepSuccessSaving || manualSleep.isPending}
                      className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-base shadow-lg shadow-indigo-200"
                    >
                      {(sleepSuccessSaving || manualSleep.isPending) ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Moon className="w-5 h-5 mr-2" />
                      )}
                      {sleepQuickNoEnd ? "ねんね開始" : "記録する"}
                    </Button>
                  </div>
                </>
              )}
            </div>

          ) : activeDialog === "sleep" && sleepStep === "manual" ? (
            <div className="space-y-4 py-4 px-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5" />
                  入眠日時
                </label>
                <ScrollDateTimePicker value={manualStartTime} onChange={setManualStartTime} />
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
                      data-testid="button-toggle-no-end"
                      onClick={() => { setManualNoEnd((v) => !v); setManualEndTime(""); setManualSleepError(""); }}
                      className={cn(
                        "text-[11px] font-bold px-2.5 py-1 rounded-xl border-2 transition-colors",
                        manualNoEnd
                          ? "bg-indigo-100 border-indigo-300 text-indigo-600"
                          : "bg-white border-gray-200 text-gray-400"
                      )}
                    >
                      {manualNoEnd ? "まだ起きていない" : "入力しない"}
                    </button>
                  )}
                </div>
                {!manualNoEnd && (
                  <ScrollDateTimePicker value={manualEndTime} onChange={(v) => { setManualEndTime(v); setManualSleepError(""); }} daysAfter={1} />
                )}
                {manualNoEnd && (
                  <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                    <p className="text-xs font-bold text-indigo-500">ねんね開始として記録します。起きたらタイマーを止めてください。</p>
                  </div>
                )}
              </div>

              {!manualNoEnd && (() => {
                const start = manualStartTime ? new Date(manualStartTime) : null;
                const end = manualEndTime ? new Date(manualEndTime) : null;
                const durationMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
                return durationMin > 0 ? (
                  <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                    <p className="text-sm font-black text-indigo-700">
                      {Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}時間` : ""}{durationMin % 60}分のねんね
                    </p>
                  </div>
                ) : null;
              })()}

              {sleepDetailSelectorJsx}

              {manualSleepError && (
                <p className="text-xs text-red-500 font-bold text-center">{manualSleepError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setManualNoEnd(false);
                    setSleepStep("main");
                  }}
                  className="h-12 rounded-2xl border-2 font-bold px-4"
                  data-testid="button-sleep-manual-back"
                >
                  戻る
                </Button>
                <Button
                  data-testid="button-sleep-manual-submit"
                  onClick={() => {
                    const start = manualStartTime ? new Date(manualStartTime) : null;
                    if (!start) { setManualSleepError("入眠時刻を入力してください"); return; }
                    const userId = localStorage.getItem("userType") || "papa";
                    if (manualNoEnd) {
                      startSleep.mutate({
                        familyId,
                        createdBy: userId,
                        startedAt: start.toISOString(),
                        ...(settlingMethod.length > 0 ? { settlingMethod: settlingMethod.join("・") } : {}),
                        ...(settlingMinutes > 0 ? { settlingMinutes } : {}),
                        ...(sleepLocation ? { sleepLocation } : {}),
                      });
                    } else {
                      const end = manualEndTime ? new Date(manualEndTime) : null;
                      if (!end) { setManualSleepError("起床時刻を入力してください（「入力しない」を使うと省略できます）"); return; }
                      if (end <= start) { setManualSleepError("起床時刻は入眠時刻より後にしてください"); return; }
                      const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                      manualSleep.mutate({
                        familyId,
                        createdBy: userId,
                        durationMin,
                        startedAt: start.toISOString(),
                        ...(settlingMethod.length > 0 ? { settlingMethod: settlingMethod.join("・") } : {}),
                        ...(settlingMinutes > 0 ? { settlingMinutes } : {}),
                        ...(sleepLocation ? { sleepLocation } : {}),
                      });
                    }
                    setManualNoEnd(false);
                    setSleepStep("main");
                    setActiveDialog(null);
                  }}
                  disabled={manualSleep.isPending || startSleep.isPending}
                  className="flex-1 h-12 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black text-base shadow-lg shadow-indigo-100"
                >
                  {(manualSleep.isPending || startSleep.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : manualNoEnd ? "ねんね開始" : "記録する"}
                </Button>
              </div>
            </div>

          ) : activeDialog === "sleep" && sleepStep === "active" ? (
            showWakeTimePickers ? (
              /* 時刻を修正 page */
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5" />
                    入眠日時
                  </label>
                  <ScrollDateTimePicker
                    value={sleepStartEditTime}
                    onChange={setSleepStartEditTime}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-500 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5" />
                    起床日時（任意）
                  </label>
                  <ScrollDateTimePicker
                    value={sleepEditWakeTime}
                    onChange={setSleepEditWakeTime}
                    daysAfter={1}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid="button-sleep-edit-time-back"
                    variant="outline"
                    onClick={() => setShowWakeTimePickers(false)}
                    className="h-12 rounded-2xl border-2 font-bold px-4"
                  >
                    戻る
                  </Button>
                  <Button
                    data-testid="button-sleep-edit-time-save"
                    onClick={async () => {
                      if (!activeSession?.id || !sleepStartEditTime) return;
                      const newStart = new Date(sleepStartEditTime);
                      if (isNaN(newStart.getTime())) return;
                      if (sleepEditWakeTime) {
                        const wakeDate = new Date(sleepEditWakeTime);
                        if (!isNaN(wakeDate.getTime()) && wakeDate > newStart) {
                          await updateSleepTime.mutateAsync({
                            id: activeSession.id,
                            startedAt: newStart.toISOString(),
                          });
                          endSleep.mutate({
                            id: activeSession.id,
                            endedAt: wakeDate.toISOString(),
                            ...(settlingMethod.length > 0 ? { settlingMethod: settlingMethod.join("・") } : {}),
                            ...(settlingMinutes > 0 ? { settlingMinutes } : {}),
                            ...(sleepLocation ? { sleepLocation } : {}),
                          });
                        } else {
                          await updateSleepTime.mutateAsync({
                            id: activeSession.id,
                            startedAt: newStart.toISOString(),
                          });
                          setSleepTimerMin(Math.max(0, differenceInMinutes(new Date(), newStart)));
                        }
                      } else {
                        await updateSleepTime.mutateAsync({
                          id: activeSession.id,
                          startedAt: newStart.toISOString(),
                        });
                        setSleepTimerMin(Math.max(0, differenceInMinutes(new Date(), newStart)));
                      }
                      setShowWakeTimePickers(false);
                      setActiveDialog(null);
                    }}
                    disabled={endSleep.isPending || updateSleepTime.isPending}
                    className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black"
                  >
                    {(endSleep.isPending || updateSleepTime.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    記録する
                  </Button>
                </div>
              </div>
            ) : (
              /* Active sleep dialog */
              <div className="space-y-3 py-4">
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-4 border border-indigo-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-200 p-2.5 rounded-2xl">
                      <Moon className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Now Sleeping</p>
                      <p className="text-lg font-black text-indigo-800" data-testid="text-sleep-dialog-timer">
                        {Math.floor(sleepTimerMin / 60) > 0 ? `${Math.floor(sleepTimerMin / 60)}時間` : ""}{sleepTimerMin % 60}分経過
                      </p>
                    </div>
                  </div>
                </div>

                {sleepDetailSelectorJsx}

                <Button
                  data-testid="button-sleep-end"
                  onClick={() => {
                    if (!activeSession?.id) return;
                    endSleep.mutate({
                      id: activeSession.id,
                      ...(settlingMethod.length > 0 ? { settlingMethod: settlingMethod.join("・") } : {}),
                      ...(settlingMinutes > 0 ? { settlingMinutes } : {}),
                      ...(sleepLocation ? { sleepLocation } : {}),
                    });
                    setActiveDialog(null);
                  }}
                  disabled={endSleep.isPending}
                  className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-base shadow-lg shadow-amber-100"
                >
                  {endSleep.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sun className="w-5 h-5 mr-2" />}
                  起きた（記録して終了）
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    data-testid="button-sleep-edit-wake-time"
                    variant="outline"
                    onClick={() => {
                      setSleepEditWakeTime("");
                      setShowWakeTimePickers(true);
                    }}
                    className="h-11 rounded-2xl border-2 border-amber-200 text-amber-600 font-bold text-sm"
                  >
                    <Sun className="w-4 h-4 mr-1" />
                    時刻を修正
                  </Button>
                  <Button
                    data-testid="button-sleep-add-nap"
                    variant="outline"
                    onClick={() => {
                      setSleepStep("manual");
                      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
                      if (!manualStartTime) setManualStartTime(now);
                      if (!manualEndTime) setManualEndTime(now);
                    }}
                    className="h-11 rounded-2xl border-2 border-indigo-200 text-indigo-600 font-bold text-sm"
                  >
                    <ClipboardList className="w-4 h-4 mr-1" />
                    昼寝を記録
                  </Button>
                </div>
              </div>
            )

          ) : activeDialog === "milk" && milkStep === "type" ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500">担当者（複数選択可）</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["mama", "papa", "other"] as const).map((role) => {
                    const selected = milkPerformers.includes(role);
                    const label = role === "mama" ? mamaLabel : role === "papa" ? papaLabel : "その他";
                    const activeStyle = role === "mama"
                      ? "bg-pink-500 border-pink-500 text-white"
                      : role === "papa"
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-gray-500 border-gray-500 text-white";
                    return (
                      <button
                        key={role}
                        type="button"
                        data-testid={`button-milk-performer-type-${role}`}
                        onClick={() =>
                          setMilkPerformers(prev =>
                            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                          )
                        }
                        className={`py-3 rounded-2xl text-sm font-black border-2 transition-colors ${
                          selected ? activeStyle : "bg-white border-gray-100 text-gray-500"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "breast", label: "母乳", icon: "🤱" },
                  { id: "formula", label: "ミルク", icon: "🍼" },
                  { id: "mixed", label: "混合", icon: "+" },
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    data-testid={`button-milk-${opt.id}`}
                    variant="outline"
                    onClick={() => { setSelectedMilkType(opt.id); setMilkStep("detail"); }}
                    className="h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center p-2"
                  >
                    <span className="text-2xl font-black">{opt.icon}</span>
                    <span className="font-bold text-xs">{opt.label}</span>
                  </Button>
                ))}
              </div>
            </div>

          ) : activeDialog === "milk" && milkStep === "detail" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}

              {(selectedMilkType === "breast" || selectedMilkType === "mixed") && (
                <>
                  <div className="space-y-3">
                    <Label className="font-bold text-xs">授乳時間</Label>

                    {/* タイマー */}
                    {(breastTimerRunning || breastTimerPaused) ? (
                      <div className={`border-2 rounded-2xl p-4 space-y-3 ${breastTimerPaused ? "bg-gray-50 border-gray-200" : "bg-pink-50 border-pink-200"}`}>
                        <div className="text-center">
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${breastTimerPaused ? "text-gray-400" : "text-pink-400"}`}>
                            {breastTimerPaused ? "一時停止中" : "授乳中"} — {breastTimerSide === "left" ? "左" : "右"}
                          </p>
                          <p className={`text-4xl font-black tabular-nums ${breastTimerPaused ? "text-gray-500" : "text-pink-600"}`} data-testid="text-breast-timer">
                            {String(Math.floor(breastTimerSec / 60)).padStart(2, "0")}:{String(breastTimerSec % 60).padStart(2, "0")}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {breastTimerPaused ? (
                            <Button
                              data-testid="button-breast-timer-resume"
                              onClick={() => {
                                setBreastTimerStart(new Date());
                                setBreastTimerRunning(true);
                                setBreastTimerPaused(false);
                              }}
                              className="h-11 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-black"
                            >
                              再開
                            </Button>
                          ) : (
                            <Button
                              data-testid="button-breast-timer-pause"
                              onClick={() => {
                                const elapsed = Date.now() - breastTimerStart!.getTime();
                                setBreastTimerAccMs(prev => prev + elapsed);
                                setBreastTimerRunning(false);
                                setBreastTimerPaused(true);
                              }}
                              variant="outline"
                              className="h-11 rounded-2xl border-2 border-pink-200 text-pink-600 font-black"
                            >
                              一時停止
                            </Button>
                          )}
                          <Button
                            data-testid="button-breast-timer-stop"
                            onClick={() => {
                              const mins = Math.round(breastTimerSec / 60);
                              if (breastTimerSide === "left") {
                                setBreastLeftMin(prev => prev + mins);
                                setLastAddedLeft(mins);
                                setLastAddedRight(0);
                              }
                              if (breastTimerSide === "right") {
                                setBreastRightMin(prev => prev + mins);
                                setLastAddedRight(mins);
                                setLastAddedLeft(0);
                              }
                              setBreastTimerRunning(false);
                              setBreastTimerPaused(false);
                              setBreastTimerStart(null);
                              setBreastTimerAccMs(0);
                              localStorage.removeItem(BREAST_TIMER_KEY);
                            }}
                            className="h-11 rounded-2xl bg-gray-700 hover:bg-gray-800 text-white font-black"
                          >
                            終了して記録
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-pink-100 overflow-hidden">
                        <p className="text-[10px] font-bold text-pink-400 text-center py-1.5 bg-pink-50">タイマーで計る</p>
                        <div className="grid grid-cols-2 gap-px bg-pink-100">
                          {(["left", "right"] as const).map((side) => (
                            <button
                              key={side}
                              data-testid={`button-breast-timer-${side}`}
                              onClick={() => {
                                setBreastTimerSide(side);
                                setBreastTimerStart(new Date());
                                setBreastTimerSec(0);
                                setBreastTimerAccMs(0);
                                setBreastTimerPaused(false);
                                setBreastTimerRunning(true);
                              }}
                              className="bg-white py-2 text-xs font-bold text-pink-600 active:bg-pink-50"
                            >
                              {side === "left" ? "左" : "右"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 数字直接入力 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 text-center">左（分）</p>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="99"
                          data-testid="input-breast-left-min"
                          value={breastLeftMin || ""}
                          placeholder="0"
                          onChange={(e) => { setBreastLeftMin(Math.max(0, Math.min(99, parseInt(e.target.value) || 0))); setLastAddedLeft(0); }}
                          className="w-full text-3xl font-black text-center border-b-2 border-pink-200 focus:border-pink-400 outline-none bg-transparent py-1 text-gray-800"
                        />
                        {lastAddedLeft > 0 && (
                          <p className="text-[10px] font-black text-pink-500 text-center">+{lastAddedLeft}分追加</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 text-center">右（分）</p>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="99"
                          data-testid="input-breast-right-min"
                          value={breastRightMin || ""}
                          placeholder="0"
                          onChange={(e) => { setBreastRightMin(Math.max(0, Math.min(99, parseInt(e.target.value) || 0))); setLastAddedRight(0); }}
                          className="w-full text-3xl font-black text-center border-b-2 border-pink-200 focus:border-pink-400 outline-none bg-transparent py-1 text-gray-800"
                        />
                        {lastAddedRight > 0 && (
                          <p className="text-[10px] font-black text-pink-500 text-center">+{lastAddedRight}分追加</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <Checkbox
                        id="expressed"
                        data-testid="checkbox-expressed"
                        checked={isExpressed}
                        onCheckedChange={(checked) => setIsExpressed(!!checked)}
                      />
                      <Label htmlFor="expressed" className="text-sm font-bold text-blue-900 cursor-pointer">
                        搾乳した母乳をあげた
                      </Label>
                    </div>
                    {isExpressed && (
                      <div className="space-y-2">
                        <Label className="font-bold text-xs">搾乳量 (ml)</Label>
                        <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3 border border-blue-100">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="500"
                            data-testid="input-expressed-ml"
                            value={expressedMl || ""}
                            placeholder="0"
                            onChange={(e) => setExpressedMl(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                            className="flex-1 text-4xl font-black text-center outline-none bg-transparent text-blue-700 w-0"
                          />
                          <span className="text-xl font-black text-blue-400">ml</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(selectedMilkType === "formula" || selectedMilkType === "mixed") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-xs">
                      {selectedMilkType === "mixed" ? "ミルクの量" : "飲んだ量"}
                    </Label>
                    <span
                      data-testid="text-formula-ml"
                      className={`text-2xl font-black tabular-nums ${formulaMl > 0 ? "text-blue-600" : "text-gray-300"}`}
                    >
                      {formulaMl > 0 ? `${formulaMl}ml` : "---"}
                    </span>
                  </div>
                  <div className="px-1 space-y-1">
                    <Slider
                      data-testid="slider-formula-ml"
                      min={30}
                      max={300}
                      step={5}
                      value={[formulaMl > 0 ? formulaMl : 30]}
                      onValueChange={(v) => setFormulaMl(v[0])}
                      className="w-full"
                    />
                    <div className="relative h-4">
                      {([30, 100, 160, 220, 300] as const).map((v, i, arr) => {
                        const pct = (v - 30) / (300 - 30) * 100;
                        const isFirst = i === 0;
                        const isLast = i === arr.length - 1;
                        return (
                          <span
                            key={v}
                            className={`absolute text-[10px] font-bold ${isFirst || isLast ? "text-gray-400" : "text-gray-300"}`}
                            style={{
                              left: `${pct}%`,
                              transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                            }}
                          >
                            {v}{isFirst || isLast ? "ml" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center space-x-2 bg-orange-50 p-3 rounded-xl border border-orange-100">
                  <Checkbox
                    id="spit-up"
                    data-testid="checkbox-spit-up"
                    checked={spitUp}
                    onCheckedChange={(checked) => {
                      setSpitUp(!!checked);
                      if (!checked) { setSpitUpAmount(""); setSpitUpTiming(""); setSpitUpNote(""); }
                    }}
                  />
                  <Label htmlFor="spit-up" className="text-sm font-bold text-orange-900 cursor-pointer">
                    吐き戻しあり
                  </Label>
                </div>

                {spitUp && (
                  <div className="space-y-3 pl-1">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-gray-500">吐き戻しの量</p>
                      <div className="flex gap-2">
                        {[
                          { value: "small", label: "少し" },
                          { value: "half", label: "半分くらい" },
                          { value: "most", label: "ほぼ全部" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            data-testid={`button-spit-up-amount-${opt.value}`}
                            onClick={() => setSpitUpAmount(opt.value)}
                            className={`flex-1 py-2 rounded-2xl text-xs font-bold border-2 transition-colors ${
                              spitUpAmount === opt.value
                                ? "bg-orange-100 border-orange-400 text-orange-700"
                                : "bg-gray-50 border-gray-200 text-gray-500"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-gray-500">タイミング</p>
                      <div className="flex gap-2">
                        {[
                          { value: "immediate", label: "直後" },
                          { value: "within_30min", label: "30分以内" },
                          { value: "within_1hour", label: "1時間以内" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            data-testid={`button-spit-up-timing-${opt.value}`}
                            onClick={() => setSpitUpTiming(opt.value)}
                            className={`flex-1 py-2 rounded-2xl text-xs font-bold border-2 transition-colors ${
                              spitUpTiming === opt.value
                                ? "bg-orange-100 border-orange-400 text-orange-700"
                                : "bg-gray-50 border-gray-200 text-gray-500"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-gray-500">メモ（任意）</p>
                      <Textarea
                        data-testid="textarea-spit-up-note"
                        value={spitUpNote}
                        onChange={(e) => setSpitUpNote(e.target.value)}
                        placeholder="例）噴水のように吐いた、ダラダラ続く…"
                        className="rounded-xl border-2 border-gray-100 min-h-[60px] text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                data-testid="button-milk-submit"
                onClick={handleMilkSubmit}
                disabled={
                  (selectedMilkType === "formula" && formulaMl === 0) ||
                  (selectedMilkType === "mixed" && breastLeftMin === 0 && breastRightMin === 0 && !isExpressed && formulaMl === 0)
                }
                className="w-full h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black text-lg shadow-lg shadow-blue-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "food" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}

              {(() => {
                const triedItems = foodIngredients.filter(i => i.status === "ok" || i.status === "caution");
                const displayItems = foodPickerCat === "all"
                  ? triedItems.map(i => ({ name: i.ingredientName, category: i.category, status: i.status }))
                  : triedItems.filter(i => i.category === foodPickerCat).map(i => ({ name: i.ingredientName, category: i.category, status: i.status }));
                const categoriesWithItems = FOOD_CATEGORIES.filter(cat =>
                  triedItems.some(i => i.category === cat.id)
                );
                const selectedNames = new Set(foodEntries.map(e => e.name).filter(Boolean));
                const addFromPicker = (name: string) => {
                  if (selectedNames.has(name)) return;
                  const empty = foodEntries.findIndex(e => !e.name.trim() && !e.amount);
                  if (empty >= 0) {
                    const next = [...foodEntries];
                    next[empty] = { name, amount: "" };
                    setFoodEntries(next);
                  } else {
                    setFoodEntries([...foodEntries, { name, amount: "" }]);
                  }
                };
                return (
                  <div className="rounded-2xl border border-purple-100 overflow-hidden">
                    <button
                      data-testid="button-toggle-food-picker"
                      onClick={() => setShowFoodPicker(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-purple-50 text-purple-700 font-bold text-xs"
                    >
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5" />
                        チェックリストから選ぶ
                        {triedItems.length > 0 && (
                          <span className="bg-purple-200 text-purple-700 px-1.5 rounded-full text-[10px] font-black">{triedItems.length}件</span>
                        )}
                      </span>
                      {showFoodPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showFoodPicker && (
                      <div className="p-2.5 space-y-2 bg-white">
                        {triedItems.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">
                            食材チェックリストで「食べた」をつけると<br />ここに表示されます
                          </p>
                        ) : (
                          <>
                            {categoriesWithItems.length > 1 && (
                              <div className="flex gap-1 flex-wrap">
                                <button
                                  onClick={() => setFoodPickerCat("all")}
                                  className={cn("px-2 h-6 rounded-lg text-[10px] font-bold border transition-colors",
                                    foodPickerCat === "all" ? "bg-purple-500 border-purple-500 text-white" : "bg-white border-gray-200 text-gray-500")}
                                >全部</button>
                                {categoriesWithItems.map(cat => (
                                  <button key={cat.id}
                                    onClick={() => setFoodPickerCat(cat.id)}
                                    className={cn("px-2 h-6 rounded-lg text-[10px] font-bold border transition-colors",
                                      foodPickerCat === cat.id ? "bg-purple-500 border-purple-500 text-white" : "bg-white border-gray-200 text-gray-500")}
                                  >{cat.label}</button>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {displayItems.map(item => {
                                const isSelected = selectedNames.has(item.name);
                                return (
                                  <button
                                    key={item.name}
                                    data-testid={`button-food-pick-${item.name}`}
                                    onClick={() => addFromPicker(item.name)}
                                    disabled={isSelected}
                                    className={cn(
                                      "flex items-center gap-1 px-2.5 h-7 rounded-xl text-xs font-bold border-2 transition-colors",
                                      isSelected
                                        ? "bg-purple-100 border-purple-200 text-purple-400"
                                        : item.status === "caution"
                                          ? "bg-amber-50 border-amber-200 text-amber-700"
                                          : "bg-white border-gray-200 text-gray-700 active:bg-purple-50"
                                    )}
                                  >
                                    {isSelected && <Check className="w-3 h-3" />}
                                    {item.name}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-xs">食べたもの（食材ごとに記録）</Label>
                  {foodEntries.some(e => e.name.trim()) && (
                    <button
                      data-testid="button-all-complete"
                      onClick={() => setFoodEntries(foodEntries.map(e => ({ ...e, amount: "完食" })))}
                      className="text-xs font-bold px-3 py-1 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      すべて完食
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {foodEntries.map((entry, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-2xl p-3 space-y-2 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <Input
                          data-testid={`input-food-name-${idx}`}
                          placeholder="食材名（例：10倍粥）"
                          value={entry.name}
                          onChange={(e) => {
                            const next = [...foodEntries];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setFoodEntries(next);
                          }}
                          className="flex-1 rounded-xl h-9 text-sm border-gray-200 bg-white"
                        />
                        {foodEntries.length > 1 && (
                          <button
                            data-testid={`button-remove-food-${idx}`}
                            onClick={() => setFoodEntries(foodEntries.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-400 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {[
                          { label: "イヤイヤ", cls: "bg-rose-500 border-rose-500 text-white" },
                          { label: "少し", cls: "bg-rose-300 border-rose-300 text-white" },
                          { label: "1/3", cls: "bg-amber-300 border-amber-300 text-white" },
                          { label: "半分", cls: "bg-amber-400 border-amber-400 text-white" },
                          { label: "2/3", cls: "bg-lime-400 border-lime-400 text-white" },
                          { label: "8割", cls: "bg-emerald-400 border-emerald-400 text-white" },
                          { label: "完食", cls: "bg-green-500 border-green-500 text-white" },
                        ].map(({ label, cls }) => (
                          <button
                            key={label}
                            data-testid={`button-food-amount-${idx}-${label}`}
                            onClick={() => {
                              const next = [...foodEntries];
                              next[idx] = { ...next[idx], amount: entry.amount === label ? "" : label };
                              setFoodEntries(next);
                            }}
                            className={cn(
                              "h-9 rounded-xl text-[10px] font-bold border-2 transition-colors px-0.5",
                              entry.amount === label ? cls : "bg-white border-gray-200 text-gray-500"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="h-1 rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-300 mt-1" />
                    </div>
                  ))}
                </div>
                <button
                  data-testid="button-add-food-entry"
                  onClick={() => setFoodEntries([...foodEntries, { name: "", amount: "" }])}
                  className="w-full h-9 rounded-xl border-2 border-dashed border-purple-200 text-purple-500 font-bold text-sm flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  食材を追加
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-xs text-gray-500">食事メモ（任意）</Label>
                <textarea
                  data-testid="textarea-food-note"
                  placeholder="例：嬉しそうに食べた、口を開けるまで時間がかかった、嫌そうな顔をした…"
                  value={foodNote}
                  onChange={(e) => setFoodNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white text-gray-700 placeholder:text-gray-300"
                />
              </div>

              <Button
                data-testid="button-food-submit"
                onClick={() => handleAction("food")}
                disabled={foodEntries.every(e => !e.amount)}
                className="w-full h-14 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-black text-lg shadow-lg shadow-purple-100"
              >
                記録する
              </Button>

              <Button
                data-testid="button-food-tracker-link"
                variant="outline"
                onClick={() => { setActiveDialog(null); navigate("/food-tracker"); }}
                className="w-full h-12 rounded-2xl border-2 border-green-200 text-green-700 font-bold text-sm"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                食材チェックリスト
              </Button>
            </div>

          ) : activeDialog === "diaper" ? (
            <div className="space-y-4 py-4">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}

              {/* おしっこ / うんち トグル選択 */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  data-testid="button-diaper-pee"
                  variant="outline"
                  onClick={() => setDiaperPee(v => !v)}
                  className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-colors ${
                    diaperPee
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-100 text-gray-500"
                  }`}
                >
                  <Droplets className={`w-7 h-7 ${diaperPee ? "text-blue-400" : "text-gray-300"}`} />
                  <span className="font-bold text-sm">おしっこ</span>
                </Button>
                <Button
                  data-testid="button-diaper-poop"
                  variant="outline"
                  onClick={() => setDiaperPoop(v => !v)}
                  className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-colors ${
                    diaperPoop
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-gray-100 text-gray-500"
                  }`}
                >
                  <CircleDot className={`w-7 h-7 ${diaperPoop ? "text-amber-400" : "text-gray-300"}`} />
                  <span className="font-bold text-sm">うんち</span>
                </Button>
              </div>

              {/* うんちの詳細（うんちが選ばれたときだけ表示） */}
              {diaperPoop && (
                <div className="space-y-3 rounded-2xl bg-amber-50 border border-amber-100 p-3">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs text-amber-700">うんちの色</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {POOP_COLORS.map((c) => {
                        const selected = poopColor === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            data-testid={`button-poop-color-${c.id}`}
                            onClick={() => setPoopColor(selected ? "" : c.id)}
                            className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-colors ${
                              selected
                                ? "border-amber-500 bg-amber-100 shadow-sm"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full ${c.color}`} />
                            <span className={`text-[10px] font-bold ${selected ? "text-amber-700" : "text-gray-600"}`}>{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs text-amber-700">形状</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {POOP_CONSISTENCY.map((c) => {
                        const selected = poopConsistency === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            data-testid={`button-poop-consistency-${c.id}`}
                            onClick={() => setPoopConsistency(selected ? "" : c.id)}
                            className={`rounded-xl border-2 font-bold text-xs h-9 transition-colors ${
                              selected ? "bg-amber-500 border-amber-500 text-white" : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs text-amber-700">量</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {STOOL_AMOUNTS.map((s) => {
                        const selected = stoolAmount === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            data-testid={`button-stool-amount-${s.id}`}
                            onClick={() => setStoolAmount(selected ? "" : s.id)}
                            className={`rounded-xl border-2 font-bold text-xs h-9 transition-colors ${
                              selected ? "bg-amber-500 border-amber-500 text-white" : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <Button
                data-testid="button-diaper-submit"
                disabled={!diaperPee && !diaperPoop && !diaperOther}
                onClick={() => handleAction("diaper")}
                className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-lg shadow-lg shadow-amber-100 disabled:opacity-40"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "milestone" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">記念日の内容</Label>
                <Input
                  data-testid="input-milestone"
                  placeholder="例：はじめて寝返りした！"
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  className="rounded-xl border-2 focus:ring-purple-200"
                />
              </div>
              <Button
                data-testid="button-milestone-submit"
                onClick={() => handleAction("milestone")}
                disabled={!milestone}
                className="w-full h-14 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-black text-lg shadow-lg shadow-purple-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "toilet" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">結果</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "success", label: "成功" },
                    { id: "fail", label: "失敗" },
                    { id: "tried", label: "誘った" },
                  ].map((opt) => (
                    <Button
                      key={opt.id}
                      data-testid={`button-toilet-${opt.id}`}
                      variant={toiletResult === opt.id ? "default" : "outline"}
                      onClick={() => setToiletResult(opt.id)}
                      className={`rounded-xl border-2 font-bold ${toiletResult === opt.id ? 'bg-cyan-500 border-cyan-500' : 'border-gray-100'}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                data-testid="button-toilet-submit"
                onClick={() => handleAction("toilet")}
                disabled={!toiletResult}
                className="w-full h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-black text-lg shadow-lg shadow-cyan-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "meal" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">食べ具合</Label>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { id: "refused", label: "イヤイヤ" },
                    { id: "little", label: "少し" },
                    { id: "third", label: "1/3" },
                    { id: "half", label: "半分" },
                    { id: "twoThirds", label: "2/3" },
                    { id: "mostly", label: "8割" },
                    { id: "complete", label: "完食" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`button-meal-${opt.id}`}
                      onClick={() => setMealResult(opt.id)}
                      className={`h-10 rounded-xl border-2 font-bold text-[11px] px-0.5 transition-colors ${mealResult === opt.id ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="h-1.5 rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-300 dark:from-rose-900/50 dark:via-amber-900/50 dark:to-emerald-900/50" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs">メニューメモ</Label>
                <Input
                  data-testid="input-meal-memo"
                  placeholder="例：カレーライス、サラダ"
                  value={mealMemo}
                  onChange={(e) => setMealMemo(e.target.value)}
                  className="rounded-xl border-2 focus:ring-orange-200"
                />
              </div>
              <Button
                data-testid="button-meal-submit"
                onClick={() => handleAction("meal")}
                disabled={!mealResult}
                className="w-full h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-lg shadow-lg shadow-orange-100"
              >
                記録する
              </Button>

              <Button
                data-testid="button-meal-food-tracker-link"
                variant="outline"
                onClick={() => { setActiveDialog(null); navigate("/food-tracker"); }}
                className="w-full h-12 rounded-2xl border-2 border-green-200 text-green-700 font-bold text-sm"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                食材チェックリスト
              </Button>
            </div>

          ) : activeDialog === "words" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">言った言葉・フレーズ</Label>
                <Input
                  data-testid="input-words"
                  placeholder="例：ママ、わんわん"
                  value={wordsText}
                  onChange={(e) => setWordsText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-green-200"
                />
              </div>
              <Button
                data-testid="button-words-submit"
                onClick={() => handleAction("words")}
                disabled={!wordsText}
                className="w-full h-14 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-lg shadow-lg shadow-green-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "discipline" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">タイプ</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "praise", label: "褒めた" },
                    { id: "scold", label: "叱った" },
                  ].map((opt) => (
                    <Button
                      key={opt.id}
                      data-testid={`button-discipline-${opt.id}`}
                      variant={disciplineType === opt.id ? "default" : "outline"}
                      onClick={() => setDisciplineType(opt.id)}
                      className={`rounded-xl border-2 font-bold ${disciplineType === opt.id ? 'bg-yellow-500 border-yellow-500' : 'border-gray-100'}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs">理由メモ</Label>
                <Input
                  data-testid="input-discipline-memo"
                  placeholder="例：お片付けできた！"
                  value={disciplineMemo}
                  onChange={(e) => setDisciplineMemo(e.target.value)}
                  className="rounded-xl border-2 focus:ring-yellow-200"
                />
              </div>
              <Button
                data-testid="button-discipline-submit"
                onClick={() => handleAction("discipline")}
                disabled={!disciplineType}
                className="w-full h-14 rounded-2xl bg-yellow-500 hover:bg-yellow-600 text-white font-black text-lg shadow-lg shadow-yellow-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "school_report" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">先生からの連絡・お友達のこと</Label>
                <Textarea
                  data-testid="input-school-report"
                  placeholder="例：今日はお友達と仲良く遊べました"
                  value={schoolReportText}
                  onChange={(e) => setSchoolReportText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-sky-200 resize-none"
                  rows={3}
                />
              </div>
              <Button
                data-testid="button-school-report-submit"
                onClick={() => handleAction("school_report")}
                disabled={!schoolReportText}
                className="w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-black text-lg shadow-lg shadow-sky-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "medicine" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">おくすりの名前</Label>
                <div className="relative">
                  <Input
                    data-testid="input-medicine-name"
                    placeholder="例：カロナール"
                    value={medicineName}
                    onChange={(e) => setMedicineName(e.target.value)}
                    className="rounded-xl border-2 focus:ring-pink-200"
                    list="medicine-suggestions"
                  />
                  {medicineSuggestions.length > 0 && (
                    <datalist id="medicine-suggestions">
                      {medicineSuggestions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs">用量</Label>
                <Input
                  data-testid="input-medicine-dose"
                  placeholder="例：5ml、1錠"
                  value={medicineDose}
                  onChange={(e) => setMedicineDose(e.target.value)}
                  className="rounded-xl border-2 focus:ring-pink-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs">メモ（任意）</Label>
                <Input
                  data-testid="input-medicine"
                  placeholder="例：食後に服用"
                  value={medicineText}
                  onChange={(e) => setMedicineText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-pink-200"
                />
              </div>
              <Button
                data-testid="button-medicine-submit"
                onClick={() => handleAction("medicine")}
                disabled={!medicineName}
                className="w-full h-14 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-black text-lg shadow-lg shadow-pink-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "hobby" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">今ハマっていること</Label>
                <Input
                  data-testid="input-hobby"
                  placeholder="例：恐竜の図鑑、お絵かき"
                  value={hobbyText}
                  onChange={(e) => setHobbyText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-fuchsia-200"
                />
              </div>
              <Button
                data-testid="button-hobby-submit"
                onClick={() => handleAction("hobby")}
                disabled={!hobbyText}
                className="w-full h-14 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-black text-lg shadow-lg shadow-fuchsia-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "achievement" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">自分でできたこと</Label>
                <Input
                  data-testid="input-achievement"
                  placeholder="例：ボタンを自分で留められた"
                  value={achievementText}
                  onChange={(e) => setAchievementText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-emerald-200"
                />
              </div>
              <Button
                data-testid="button-achievement-submit"
                onClick={() => handleAction("achievement")}
                disabled={!achievementText}
                className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg shadow-lg shadow-emerald-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "schedule" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">明日の準備・予定</Label>
                <Textarea
                  data-testid="input-schedule"
                  placeholder="例：遠足の準備、お弁当作る"
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-violet-200 resize-none"
                  rows={3}
                />
              </div>
              <Button
                data-testid="button-schedule-submit"
                onClick={() => handleAction("schedule")}
                disabled={!scheduleText}
                className="w-full h-14 rounded-2xl bg-violet-500 hover:bg-violet-600 text-white font-black text-lg shadow-lg shadow-violet-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "school_prep" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">入学準備タスク</Label>
                <Textarea
                  data-testid="input-school-prep"
                  placeholder="例：ランドセル選び、名前シール貼り"
                  value={schoolPrepText}
                  onChange={(e) => setSchoolPrepText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-blue-200 resize-none"
                  rows={3}
                />
              </div>
              <Button
                data-testid="button-school-prep-submit"
                onClick={() => handleAction("school_prep")}
                disabled={!schoolPrepText}
                className="w-full h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-black text-lg shadow-lg shadow-blue-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "play" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">あそびの種類（複数選択可）</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PLAY_OPTIONS.map((opt) => {
                    const selected = playTypes.includes(opt.id);
                    return (
                      <Button
                        key={opt.id}
                        data-testid={`button-play-${opt.id}`}
                        variant={selected ? "default" : "outline"}
                        onClick={() =>
                          setPlayTypes(prev =>
                            prev.includes(opt.id)
                              ? prev.filter(id => id !== opt.id)
                              : [...prev, opt.id]
                          )
                        }
                        className={`rounded-xl border-2 font-bold text-xs ${selected ? 'bg-lime-500 border-lime-500 text-white' : 'border-gray-100'}`}
                      >
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs">メモ</Label>
                <Input
                  data-testid="input-play-memo"
                  placeholder="例：公園でブランコ、積み木タワー"
                  value={playMemo}
                  onChange={(e) => setPlayMemo(e.target.value)}
                  className="rounded-xl border-2 focus:ring-lime-200"
                />
              </div>
              <Button
                data-testid="button-play-submit"
                onClick={() => handleAction("play")}
                disabled={playTypes.length === 0}
                className="w-full h-14 rounded-2xl bg-lime-500 hover:bg-lime-600 text-white font-black text-lg shadow-lg shadow-lime-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "snack" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">おやつの内容（任意）</Label>
                <Input
                  data-testid="input-snack"
                  placeholder="例：バナナ、ボーロ、おせんべい（空欄でもOK）"
                  value={snackText}
                  onChange={(e) => setSnackText(e.target.value)}
                  className="rounded-xl border-2 focus:ring-pink-200"
                />
              </div>
              <Button
                data-testid="button-snack-submit"
                onClick={() => handleAction("snack")}
                className="w-full h-14 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-black text-lg shadow-lg shadow-pink-100"
              >
                {snackText.trim() ? "記録する" : "サッと記録"}
              </Button>
            </div>

          ) : activeDialog === "drink" ? (
            <div className="space-y-5 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <Label className="font-bold text-xs">飲み物の種類</Label>
                <div className="flex flex-wrap gap-2">
                  {["お水", "麦茶", "牛乳", "りんごジュース", "みかんジュース", "野菜ジュース", "お茶", "その他"].map((d) => (
                    <button
                      key={d}
                      data-testid={`chip-drink-${d}`}
                      onClick={() => setDrinkType(drinkType === d ? "" : d)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-bold border transition-all",
                        drinkType === d
                          ? "bg-cyan-500 text-white border-cyan-500"
                          : "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {drinkType === "その他" && (
                <div className="space-y-2">
                  <Label className="font-bold text-xs">飲み物の名前</Label>
                  <Input
                    data-testid="input-drink-custom"
                    placeholder="例：スポーツドリンク、豆乳..."
                    value={drinkCustom}
                    onChange={(e) => setDrinkCustom(e.target.value)}
                    className="rounded-xl border-2 focus:ring-cyan-200"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="font-bold text-xs">量（任意）</Label>
                <div className="flex gap-2 flex-wrap">
                  {["50", "100", "150", "200"].map((ml) => (
                    <button
                      key={ml}
                      data-testid={`chip-drink-amount-${ml}`}
                      onClick={() => setDrinkAmount(drinkAmount === ml ? "" : ml)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-bold border transition-all",
                        drinkAmount === ml
                          ? "bg-cyan-500 text-white border-cyan-500"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      {ml}ml
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      data-testid="input-drink-amount"
                      type="number"
                      placeholder="その他"
                      value={["50","100","150","200"].includes(drinkAmount) ? "" : drinkAmount}
                      onChange={(e) => setDrinkAmount(e.target.value)}
                      className="w-20 rounded-xl border-2 focus:ring-cyan-200 text-sm"
                    />
                    <span className="text-sm text-gray-500">ml</span>
                  </div>
                </div>
              </div>
              <Button
                data-testid="button-drink-submit"
                onClick={() => handleAction("drink")}
                disabled={!drinkType || (drinkType === "その他" && !drinkCustom)}
                className="w-full h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-black text-lg shadow-lg shadow-cyan-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "temperature" ? (
            <div className="space-y-5 py-4 px-2">
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "text-6xl font-black tabular-nums tracking-tight transition-colors",
                  tempValue >= 38.5 ? "text-red-500" : tempValue >= 37.5 ? "text-amber-500" : "text-green-500"
                )}>
                  {tempValue.toFixed(1)}
                  <span className="text-3xl ml-1">°C</span>
                </div>
                <div className={cn(
                  "text-xs font-bold px-3 py-1 rounded-full",
                  tempValue >= 38.5 ? "bg-red-100 text-red-600" : tempValue >= 37.5 ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                )}>
                  {tempValue >= 38.5 ? "発熱" : tempValue >= 37.5 ? "微熱" : "平熱"}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <Button
                    data-testid="button-temp-minus"
                    variant="outline"
                    className="w-14 h-14 rounded-2xl text-2xl font-black border-2"
                    onClick={() => setTempValue(v => Math.max(35.0, Math.round((v - 0.1) * 10) / 10))}
                  >
                    −
                  </Button>
                  <div className="flex gap-2">
                    {[36.0, 36.5, 37.0, 37.5, 38.0].map(v => (
                      <button
                        key={v}
                        data-testid={`button-temp-preset-${v}`}
                        onClick={() => setTempValue(v)}
                        className={cn(
                          "w-8 h-8 rounded-full text-xs font-bold border-2 transition-all",
                          Math.abs(tempValue - v) < 0.05
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-gray-500 border-gray-200"
                        )}
                      >
                        {v.toFixed(1)}
                      </button>
                    ))}
                  </div>
                  <Button
                    data-testid="button-temp-plus"
                    variant="outline"
                    className="w-14 h-14 rounded-2xl text-2xl font-black border-2"
                    onClick={() => setTempValue(v => Math.min(42.0, Math.round((v + 0.1) * 10) / 10))}
                  >
                    ＋
                  </Button>
                </div>
              </div>
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <Button
                data-testid="button-temperature-submit"
                onClick={() => handleAction("temperature")}
                className={cn(
                  "w-full h-14 rounded-2xl text-white font-black text-lg shadow-lg",
                  tempValue >= 38.5 ? "bg-red-500 hover:bg-red-600 shadow-red-100" : tempValue >= 37.5 ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" : "bg-green-500 hover:bg-green-600 shadow-green-100"
                )}
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "bath" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500">担当者（複数選択可）</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["papa", "mama", "other"] as const).map((role) => {
                    const selected = bathPerformers.includes(role);
                    const label = role === "papa" ? papaLabel : role === "mama" ? mamaLabel : "その他";
                    return (
                      <button
                        key={role}
                        data-testid={`button-bath-performer-${role}`}
                        onClick={() =>
                          setBathPerformers(prev =>
                            prev.includes(role)
                              ? prev.filter(r => r !== role)
                              : [...prev, role]
                          )
                        }
                        className={`py-3 rounded-2xl text-sm font-black border-2 transition-colors ${
                          selected
                            ? role === "other" ? "bg-gray-500 border-gray-500 text-white" : "bg-sky-500 border-sky-500 text-white"
                            : "bg-white border-gray-100 text-gray-500"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                data-testid="button-bath-submit"
                onClick={() => handleAction("bath")}
                disabled={bathPerformers.length === 0}
                className="w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-black text-lg shadow-lg shadow-sky-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "hold" ? (
            <div className="space-y-4 py-4 px-2">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-gray-500">開始時刻</p>
                {dateTimePickerJsx}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500">終了時刻（任意）</p>
                  {holdEndTime && (
                    <button
                      type="button"
                      data-testid="button-clear-hold-end-time"
                      onClick={() => setHoldEndTime("")}
                      className="text-[10px] text-gray-400 font-bold underline"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <DateTimeClock
                  value={holdEndTime || logDateTime}
                  onChange={v => setHoldEndTime(v)}
                />
                {holdEndTime && logDateTime && new Date(holdEndTime) > new Date(logDateTime) && (
                  <p className="text-[11px] text-violet-500 font-bold text-center">
                    {Math.round((new Date(holdEndTime).getTime() - new Date(logDateTime).getTime()) / 60000)}分間
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500">担当者（複数選択可）</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["papa", "mama", "other"] as const).map((role) => {
                    const selected = holdPerformers.includes(role);
                    const label = role === "papa" ? papaLabel : role === "mama" ? mamaLabel : "その他";
                    return (
                      <button
                        key={role}
                        data-testid={`button-hold-performer-${role}`}
                        onClick={() =>
                          setHoldPerformers(prev =>
                            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                          )
                        }
                        className={`py-3 rounded-2xl text-sm font-black border-2 transition-colors ${
                          selected
                            ? role === "other" ? "bg-gray-500 border-gray-500 text-white" : "bg-violet-500 border-violet-500 text-white"
                            : "bg-white border-gray-100 text-gray-500"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-gray-500">メモ（任意）</p>
                <Input
                  value={holdNote}
                  onChange={e => setHoldNote(e.target.value)}
                  placeholder="様子など…"
                  className="rounded-xl border-2 text-sm"
                  data-testid="input-hold-note"
                />
              </div>
              <Button
                data-testid="button-hold-submit"
                onClick={() => handleAction("hold")}
                disabled={holdPerformers.length === 0 || createLog.isPending}
                className="w-full h-14 rounded-2xl bg-violet-500 hover:bg-violet-600 text-white font-black text-lg shadow-lg shadow-violet-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "clinic" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5" /> 病院名・内容（任意）
                </label>
                <textarea
                  data-testid="input-clinic-text"
                  className="w-full rounded-2xl border-2 border-gray-100 p-3 text-sm resize-none focus:outline-none focus:border-teal-300"
                  rows={3}
                  placeholder="例: 小児科・発熱で受診"
                  value={clinicText}
                  onChange={(e) => setClinicText(e.target.value)}
                />
              </div>
              <Button
                data-testid="button-clinic-submit"
                onClick={() => handleAction("clinic")}
                className="w-full h-14 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black text-lg shadow-lg shadow-teal-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "toothbrush" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <Button
                data-testid="button-toothbrush-submit"
                onClick={() => handleAction("toothbrush")}
                disabled={multiPerformers.length === 0}
                className="w-full h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-black text-lg shadow-lg shadow-cyan-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "nail_care" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <Button
                data-testid="button-nail-care-submit"
                onClick={() => handleAction("nail_care")}
                disabled={multiPerformers.length === 0}
                className="w-full h-14 rounded-2xl bg-slate-500 hover:bg-slate-600 text-white font-black text-lg shadow-lg shadow-slate-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "skincare" ? (
            <div className="space-y-4 py-4 px-2">
              {dateTimePickerJsx}
              {multiPerformerSelectorJsx}
              <Button
                data-testid="button-skincare-submit"
                onClick={() => handleAction("skincare")}
                disabled={multiPerformers.length === 0}
                className="w-full h-14 rounded-2xl bg-rose-400 hover:bg-rose-500 text-white font-black text-lg shadow-lg shadow-rose-100"
              >
                記録する
              </Button>
            </div>

          ) : activeDialog === "express" ? (
            <div className="space-y-4 py-4 px-2">
              {expressStep === "timer" ? (
                <>
                  {dateTimePickerJsx}

                  {/* タイマー / 手入力 切替 */}
                  <div className="flex justify-center">
                    <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
                      <button
                        type="button"
                        data-testid="button-express-mode-timer"
                        onClick={() => setExpressManualMode(false)}
                        className={cn(
                          "px-4 py-1.5 rounded-xl text-xs font-black transition-all",
                          !expressManualMode
                            ? "bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-300 shadow-sm"
                            : "text-gray-400"
                        )}
                      >
                        タイマー
                      </button>
                      <button
                        type="button"
                        data-testid="button-express-mode-manual"
                        onClick={() => {
                          if (expressActiveSide !== null) {
                            if (expressActiveSide === "left") setExpressLeftAccSec(expressLeftSec);
                            else setExpressRightAccSec(expressRightSec);
                            setExpressActiveSide(null);
                            setExpressSideStartMs(null);
                          }
                          if (expressManualLeftMin === "" && expressLeftSec > 0) {
                            setExpressManualLeftMin(Math.round(expressLeftSec / 60));
                          }
                          if (expressManualRightMin === "" && expressRightSec > 0) {
                            setExpressManualRightMin(Math.round(expressRightSec / 60));
                          }
                          setExpressManualMode(true);
                        }}
                        className={cn(
                          "px-4 py-1.5 rounded-xl text-xs font-black transition-all",
                          expressManualMode
                            ? "bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-300 shadow-sm"
                            : "text-gray-400"
                        )}
                      >
                        手入力
                      </button>
                    </div>
                  </div>

                  {expressManualMode ? (
                    /* 手入力: 左・右の時間を直接入力 */
                    <div className="grid grid-cols-2 gap-3">
                      {(["left", "right"] as const).map((side) => {
                        const value = side === "left" ? expressManualLeftMin : expressManualRightMin;
                        const setter = side === "left" ? setExpressManualLeftMin : setExpressManualRightMin;
                        return (
                          <div
                            key={side}
                            className="rounded-3xl p-4 border-2 bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-center"
                          >
                            <p className="text-xs font-black mb-2 tracking-widest text-gray-400">
                              {side === "left" ? "左" : "右"}
                            </p>
                            <div className="flex items-baseline justify-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={120}
                                placeholder="0"
                                data-testid={`input-express-manual-${side}`}
                                value={value === "" ? "" : value}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "") {
                                    setter("");
                                  } else {
                                    const n = Math.max(0, Math.min(120, Number(raw) || 0));
                                    setter(n);
                                  }
                                }}
                                className="w-16 text-3xl font-black tabular-nums bg-transparent border-b-2 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300 text-center outline-none focus:border-teal-400"
                              />
                              <span className="text-sm font-black text-gray-400">分</span>
                            </div>
                            <p className="text-[10px] font-bold mt-2 text-gray-400">直接入力</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                  /* 左・右タイマーボタン（左が先頭に来るよう順序修正） */
                  <div className="grid grid-cols-2 gap-3">
                    {(["left", "right"] as const).map((side) => {
                      const isActive = expressActiveSide === side;
                      const sec = side === "left" ? expressLeftSec : expressRightSec;
                      const hasTime = sec > 0;
                      const alarmFired = side === "left" ? expressLeftAlarmFired : expressRightAlarmFired;
                      return (
                        <button
                          key={side}
                          data-testid={`button-express-side-${side}`}
                          type="button"
                          onClick={() => {
                            const now = Date.now();
                            if (expressActiveSide === side) {
                              if (side === "left") setExpressLeftAccSec(expressLeftSec);
                              else setExpressRightAccSec(expressRightSec);
                              setExpressActiveSide(null);
                              setExpressSideStartMs(null);
                            } else {
                              if (expressActiveSide !== null) {
                                if (expressActiveSide === "left") setExpressLeftAccSec(expressLeftSec);
                                else setExpressRightAccSec(expressRightSec);
                              }
                              warmupAudio();
                              setExpressActiveSide(side);
                              setExpressSideStartMs(now);
                            }
                          }}
                          className={cn(
                            "relative rounded-3xl p-4 border-2 text-center transition-all active:scale-95 select-none",
                            alarmFired
                              ? "bg-amber-50 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 animate-pulse"
                              : isActive
                              ? "bg-teal-50 dark:bg-teal-900/40 border-teal-300 dark:border-teal-600 shadow-lg shadow-teal-100"
                              : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
                          )}
                        >
                          {isActive && !alarmFired && (
                            <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                          )}
                          {alarmFired && (
                            <div className="absolute top-2 right-2 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">アラーム</div>
                          )}
                          <p className={cn("text-xs font-black mb-2 tracking-widest", alarmFired ? "text-amber-600" : isActive ? "text-teal-500" : "text-gray-400")}>
                            {side === "left" ? "左" : "右"}
                          </p>
                          <p className={cn("text-3xl font-black tabular-nums leading-none", alarmFired ? "text-amber-700" : isActive ? "text-teal-700 dark:text-teal-300" : "text-gray-600 dark:text-gray-300")} data-testid={`text-express-timer-${side}`}>
                            {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}
                          </p>
                          <p className={cn("text-[10px] font-bold mt-2", alarmFired ? "text-amber-500" : isActive ? "text-teal-400" : "text-gray-400")}>
                            {alarmFired ? "アラーム鳴動中" : isActive ? "タップで停止" : hasTime ? "タップで再開" : "タップで開始"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  )}

                  {/* アラーム設定（タイマーモードのみ） */}
                  {!expressManualMode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-500 shrink-0">アラーム</span>
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        data-testid="input-express-alarm-min"
                        type="number"
                        min={0}
                        max={60}
                        placeholder="0"
                        value={expressAlarmMin === 0 ? "" : expressAlarmMin}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                          setExpressAlarmMin(val);
                          setExpressLeftAlarmFired(false);
                          setExpressRightAlarmFired(false);
                        }}
                        className={cn(
                          "w-16 h-9 rounded-xl border-2 text-center text-sm font-black tabular-nums bg-gray-50 dark:bg-gray-800 outline-none transition-all",
                          expressAlarmMin > 0
                            ? "border-teal-400 text-teal-700 dark:text-teal-300"
                            : "border-gray-200 text-gray-500"
                        )}
                      />
                      <span className="text-xs font-bold text-gray-400">分後</span>
                      {expressAlarmMin > 0 && (
                        <button
                          data-testid="button-express-alarm-off"
                          type="button"
                          onClick={() => {
                            setExpressAlarmMin(0);
                            setExpressLeftAlarmFired(false);
                            setExpressRightAlarmFired(false);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-black border border-gray-200 text-gray-400 bg-gray-50"
                        >
                          OFF
                        </button>
                      )}
                    </div>
                  </div>
                  )}

                  {/* 合計 */}
                  <div className="text-center py-1">
                    <span className="text-xs text-gray-400 font-bold">合計　</span>
                    <span className="text-xl font-black text-teal-600 tabular-nums">
                      {(() => {
                        const totalSec = expressManualMode
                          ? ((typeof expressManualLeftMin === "number" ? expressManualLeftMin : 0) + (typeof expressManualRightMin === "number" ? expressManualRightMin : 0)) * 60
                          : expressLeftSec + expressRightSec;
                        return `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;
                      })()}
                    </span>
                  </div>

                  <Button
                    data-testid="button-express-done-timing"
                    onClick={() => {
                      if (expressManualMode) {
                        const leftMin = typeof expressManualLeftMin === "number" ? expressManualLeftMin : 0;
                        const rightMin = typeof expressManualRightMin === "number" ? expressManualRightMin : 0;
                        setExpressLeftSec(leftMin * 60);
                        setExpressRightSec(rightMin * 60);
                        setExpressLeftAccSec(leftMin * 60);
                        setExpressRightAccSec(rightMin * 60);
                        setExpressActiveSide(null);
                        setExpressSideStartMs(null);
                      } else if (expressActiveSide !== null) {
                        if (expressActiveSide === "left") setExpressLeftAccSec(expressLeftSec);
                        else setExpressRightAccSec(expressRightSec);
                        setExpressActiveSide(null);
                        setExpressSideStartMs(null);
                      }
                      setExpressStep("amount");
                    }}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-black text-base shadow-lg shadow-teal-100"
                  >
                    <Droplets className="w-5 h-5 mr-2" />
                    搾乳完了・量を記録する
                  </Button>

                  <div className="flex gap-2">
                    {(expressLeftAccSec > 0 || expressRightAccSec > 0 || expressActiveSide !== null) && (
                      <Button
                        data-testid="button-express-reset"
                        variant="outline"
                        onClick={() => resetExpressTimer(true)}
                        className="flex-1 h-11 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold text-sm"
                      >
                        リセット
                      </Button>
                    )}
                    {expressActiveSide !== null && (
                      <Button
                        data-testid="button-express-cancel-timer"
                        variant="outline"
                        onClick={() => setShowExpressTimerCancelConfirm(true)}
                        className="flex-1 h-11 rounded-2xl border-2 border-red-200 text-red-400 font-bold text-sm"
                      >
                        キャンセル
                      </Button>
                    )}
                  </div>

                  <Button
                    data-testid="button-express-close"
                    variant="outline"
                    onClick={() => {
                      setActiveDialog(null);
                      resetNewDialogs();
                    }}
                    className="w-full h-11 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold"
                  >
                    {expressActiveSide !== null ? "タイマーを継続して閉じる" : "閉じる"}
                  </Button>
                </>
              ) : (
                <>
                  {/* タイマー結果サマリー */}
                  {(expressRightSec > 0 || expressLeftSec > 0) && (
                    <div className="bg-teal-50 dark:bg-teal-900/30 rounded-2xl p-3 border border-teal-100 dark:border-teal-800 flex justify-center gap-6">
                      {expressRightSec > 0 && (
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-gray-400 mb-0.5">右</p>
                          <p className="text-lg font-black text-teal-700 dark:text-teal-300">
                            {Math.floor(expressRightSec / 60)}分{expressRightSec % 60 > 0 ? `${expressRightSec % 60}秒` : ""}
                          </p>
                        </div>
                      )}
                      {expressRightSec > 0 && expressLeftSec > 0 && (
                        <div className="w-px bg-teal-200 dark:bg-teal-700 self-stretch" />
                      )}
                      {expressLeftSec > 0 && (
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-gray-400 mb-0.5">左</p>
                          <p className="text-lg font-black text-teal-700 dark:text-teal-300">
                            {Math.floor(expressLeftSec / 60)}分{expressLeftSec % 60 > 0 ? `${expressLeftSec % 60}秒` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 搾乳量 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-teal-700">搾乳量</p>
                      <span className="text-3xl font-black text-teal-600">
                        {expressAmount > 0 ? expressAmount : 30}<span className="text-base font-bold ml-1">ml</span>
                      </span>
                    </div>
                    <div className="px-1 space-y-1">
                      <Slider
                        data-testid="slider-express-amount"
                        min={10}
                        max={300}
                        step={5}
                        value={[expressAmount > 0 ? expressAmount : 30]}
                        onValueChange={(v) => setExpressAmount(v[0])}
                        className="w-full"
                      />
                      <div className="relative h-4">
                        {([10, 100, 200, 300] as const).map((v, i, arr) => {
                          const pct = (v - 10) / (300 - 10) * 100;
                          const isFirst = i === 0;
                          const isLast = i === arr.length - 1;
                          return (
                            <span
                              key={v}
                              className={`absolute text-[10px] font-bold ${isFirst || isLast ? "text-gray-400" : "text-gray-300"}`}
                              style={{ left: `${pct}%`, transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)" }}
                            >
                              {v}{isFirst || isLast ? "ml" : ""}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 記録する */}
                  <Button
                    data-testid="button-express-save"
                    disabled={isPending}
                    onClick={() => {
                      const rightMin = Math.round(expressRightSec / 60);
                      const leftMin = Math.round(expressLeftSec / 60);
                      const ml = expressAmount > 0 ? expressAmount : 30;
                      const parts: string[] = [];
                      if (rightMin > 0) parts.push(`右${rightMin}分`);
                      if (leftMin > 0) parts.push(`左${leftMin}分`);
                      const timerStr = parts.length > 0 ? `（${parts.join("・")}）` : "";
                      const createdAt = getCreatedAtFromDateTime();
                      mutate({
                        type: "milk",
                        subType: "express",
                        message: `搾乳 ${ml}ml${timerStr}`,
                        expressedMl: ml,
                        breastLeftMin: leftMin || null,
                        breastRightMin: rightMin || null,
                        familyId,
                        userId: localStorage.getItem("userType") || "papa",
                        childId: activeChildId ?? null,
                        ...(createdAt ? { createdAt } : {}),
                      } as any);
                      resetExpressTimer(true);
                      setActiveDialog(null);
                    }}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-black text-base shadow-lg shadow-teal-100"
                  >
                    {isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Droplets className="w-5 h-5 mr-2" />
                    )}
                    記録する
                  </Button>

                  <Button
                    data-testid="button-express-back"
                    variant="outline"
                    onClick={() => setExpressStep("timer")}
                    className="w-full h-11 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold"
                  >
                    タイマーに戻る
                  </Button>
                </>
              )}
            </div>

          ) : (
            <div className="grid grid-cols-2 gap-3 py-4">
              {activeDialog && actions.find(a => a.id === activeDialog)?.options?.map((opt) => (
                <Button
                  key={opt.id}
                  data-testid={`button-option-${opt.id}`}
                  variant="outline"
                  onClick={() => handleAction(activeDialog, opt.id, opt.label)}
                  className="h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 hover:bg-purple-50 hover:border-purple-200 text-center p-2"
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-bold text-xs">{opt.label}</span>
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBreastTimerCancelConfirm} onOpenChange={setShowBreastTimerCancelConfirm}>
        <AlertDialogContent className="rounded-[2rem] border-none max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">タイマーを終了しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500">
              計測中の授乳タイマーが失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-center">
            <AlertDialogCancel
              className="flex-1 h-11 rounded-2xl border-2 font-bold m-0"
              onClick={() => setShowBreastTimerCancelConfirm(false)}
            >
              戻る
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black m-0"
              onClick={() => {
                setShowBreastTimerCancelConfirm(false);
                setActiveDialog(null);
                resetMilk(true);
                resetDiaper();
                resetNewDialogs();
                setSleepStep("main");
                setShowDateTimeInput(false);
                setSettlingMethod([]);
                setSettlingMinutes(0);
                setSleepLocation("");
                setSleepSuccessRecorded(false);
                setFoodNote("");
                setFoodEntries([{ name: "", amount: "" }]);
                setShowWakeTimePickers(false);
                setPlayTypes([]);
                setPlayMemo("");
              }}
            >
              キャンセルする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExpressTimerCancelConfirm} onOpenChange={setShowExpressTimerCancelConfirm}>
        <AlertDialogContent className="rounded-[2rem] border-none max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center font-black">タイマーを終了しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500">
              計測中の搾乳タイマーが失われます。<br />
              継続する場合は「バックグラウンドで継続」を選んでください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              className="w-full h-11 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-black"
              onClick={() => {
                setShowExpressTimerCancelConfirm(false);
                setActiveDialog(null);
                resetNewDialogs();
              }}
            >
              バックグラウンドで継続
            </Button>
            <AlertDialogCancel
              className="w-full h-11 rounded-2xl border-2 font-bold m-0"
              onClick={() => setShowExpressTimerCancelConfirm(false)}
            >
              戻る
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black m-0"
              onClick={() => {
                setShowExpressTimerCancelConfirm(false);
                setActiveDialog(null);
                resetExpressTimer(true);
                resetDiaper();
                resetMilk();
                resetNewDialogs();
                setSleepStep("main");
                setShowDateTimeInput(false);
                setSettlingMethod([]);
                setSettlingMinutes(0);
                setSleepLocation("");
                setSleepSuccessRecorded(false);
                setFoodNote("");
                setFoodEntries([{ name: "", amount: "" }]);
                setShowWakeTimePickers(false);
                setPlayTypes([]);
                setPlayMemo("");
              }}
            >
              タイマーを終了する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* カスタムクイックログ 記録ダイアログ */}
      <Dialog open={!!activeCustomAction} onOpenChange={(open) => { if (!open) { setActiveCustomAction(null); setCustomMemo(""); } }}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none max-h-[80vh] overflow-y-auto top-[45%] sm:top-[50%]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              {activeCustomAction?.label}の記録
            </DialogTitle>
          </DialogHeader>
          {activeCustomAction && (() => {
            const scheme = getCustomColorScheme(activeCustomAction.colorScheme);
            return (
              <div className="space-y-4 py-4 px-2">
                {dateTimePickerJsx}
                {multiPerformerSelectorJsx}
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-600">メモ（任意）</p>
                  <Textarea
                    data-testid="textarea-custom-memo"
                    value={customMemo}
                    onChange={e => setCustomMemo(e.target.value)}
                    placeholder="メモを入力..."
                    className="rounded-2xl border-2 text-sm"
                    rows={2}
                  />
                </div>
                <Button
                  data-testid="button-custom-log-submit"
                  onClick={() => {
                    if (multiPerformers.length === 0) return;
                    const ca = logDateTime ? new Date(logDateTime) : null;
                    const performerStr = multiPerformers.join("・");
                    const performerLabel = multiPerformers.map(getUserLabel).join("・");
                    const msg = customMemo.trim()
                      ? `${performerLabel}が${activeCustomAction.label}をしました（${customMemo.trim()}）`
                      : `${performerLabel}が${activeCustomAction.label}をしました`;
                    mutate({
                      type: "custom",
                      subType: activeCustomAction.label,
                      message: msg,
                      performedBy: performerStr,
                      ...(ca && { createdAt: ca }),
                    });
                    setActiveCustomAction(null);
                    setCustomMemo("");
                  }}
                  disabled={multiPerformers.length === 0 || isPending}
                  className={`w-full h-14 rounded-2xl text-white font-black text-lg shadow-lg ${scheme.btn} hover:opacity-90`}
                >
                  記録する
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* カスタムボタン 追加ダイアログ */}
      <Dialog open={showAddCustomAction} onOpenChange={setShowAddCustomAction}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none max-h-[85vh] overflow-y-auto top-[45%] sm:top-[50%]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">カスタムボタンを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4 px-2">
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-600">ボタン名</p>
              <Input
                data-testid="input-new-custom-label"
                value={newCustomLabel}
                onChange={e => setNewCustomLabel(e.target.value)}
                placeholder="例：肛門刺激、爪磨き..."
                className="rounded-2xl border-2 h-12 text-sm"
                maxLength={12}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-600">アイコン</p>
              <div className="grid grid-cols-6 gap-2">
                {CUSTOM_ICON_OPTIONS.map(({ name, Icon }) => (
                  <button
                    key={name}
                    data-testid={`button-icon-${name}`}
                    onClick={() => setNewCustomIconName(name)}
                    className={`aspect-square rounded-2xl border-2 flex items-center justify-center transition-all ${newCustomIconName === name ? "bg-purple-100 border-purple-400" : "bg-gray-50 border-gray-200 hover:border-purple-200"}`}
                  >
                    <Icon className={`w-5 h-5 ${newCustomIconName === name ? "text-purple-600" : "text-gray-500"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-600">カラー</p>
              <div className="flex gap-2 flex-wrap">
                {CUSTOM_COLOR_SCHEMES.map(scheme => (
                  <button
                    key={scheme.id}
                    data-testid={`button-color-${scheme.id}`}
                    onClick={() => setNewCustomColorScheme(scheme.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${newCustomColorScheme === scheme.id ? `${scheme.bg} ${scheme.text} ${scheme.border}` : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    <span className={`w-3 h-3 rounded-full ${scheme.btn}`} />
                    {scheme.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-2xl border-2 border-gray-100 bg-gray-50 flex flex-col items-center gap-2">
              <p className="text-[10px] font-bold text-gray-400">プレビュー</p>
              {(() => {
                const scheme = getCustomColorScheme(newCustomColorScheme);
                const IconComp = getCustomIconComponent(newCustomIconName);
                return (
                  <div className={`flex flex-col items-center gap-2 py-3 px-5 rounded-[2rem] border-2 ${scheme.bg} ${scheme.text} ${scheme.border}`}>
                    <div className="bg-white/95 p-2.5 rounded-full shadow-sm">
                      <IconComp className="w-5 h-5 stroke-[2.5px]" />
                    </div>
                    <span className="font-bold text-xs">{newCustomLabel || "ボタン名"}</span>
                  </div>
                );
              })()}
            </div>
            <Button
              data-testid="button-create-custom-action"
              onClick={() => {
                if (!newCustomLabel.trim()) return;
                createCustomQuickAction.mutate({ label: newCustomLabel.trim(), iconName: newCustomIconName, colorScheme: newCustomColorScheme });
              }}
              disabled={!newCustomLabel.trim() || createCustomQuickAction.isPending}
              className="w-full h-14 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-black text-lg shadow-lg shadow-purple-100"
            >
              追加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
