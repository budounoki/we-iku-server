import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUserLabels } from "@/hooks/use-user-labels";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Moon, Check, EyeOff, Eye, Thermometer, Shield, Volume2,
  Bath, Shirt, Milk as MilkIcon, BookOpen, Lamp, Plus, Trash2,
  Timer, Play, Square, RotateCcw, Zap, Users, ChevronRight,
  CheckCircle2, Circle, Loader2, BarChart3, TrendingUp, Star,
  Settings2, Bell,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BottomNav } from "@/components/Navigation";
import {
  useSleepChecklist,
  useUpdateSleepChecklist,
  useSleepRoutines,
  useCreateSleepRoutine,
  useDeleteSleepRoutine,
  useSleepRoutineLogs,
  useCompleteSleepRoutineStep,
  useLogs,
  useSleepSessions,
} from "@/hooks/use-app-data";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const CHECKLIST_ITEMS = [
  {
    key: "darkness" as const,
    label: "遮光",
    desc: "部屋は真っ暗か？",
    icon: EyeOff,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  {
    key: "temperature" as const,
    label: "室温",
    desc: "夏：25-27度 / 冬：20度前後か？",
    icon: Thermometer,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  {
    key: "safety" as const,
    label: "安全",
    desc: "枕やぬいぐるみなど窒息の危険がないか？",
    icon: Shield,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  {
    key: "whiteNoise" as const,
    label: "ホワイトノイズ",
    desc: "音の準備はいいか？",
    icon: Volume2,
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
];

const ROUTINE_ICONS: Record<string, typeof Bath> = {
  "お風呂": Bath,
  "着替え": Shirt,
  "授乳/ミルク": MilkIcon,
  "絵本": BookOpen,
  "消灯（入眠）": Lamp,
};

const TIMER_PHASES = [
  { minutes: 0, message: "セルフねんねの特訓開始です。今は信じて待ちましょう。" },
  { minutes: 2, message: "2分経過。まだ大丈夫、赤ちゃんは自分で寝る方法を探しています。" },
  { minutes: 5, message: "まだ泣いていますね。でも大丈夫、脳が『自分で寝る方法』を学習中です。あと2分で見守りに行きましょう。" },
  { minutes: 7, message: "一度トントンしに行って、安心させてあげましょう。でも抱っこは我慢です。" },
  { minutes: 10, message: "10分経過。赤ちゃんの自立心が育っています。もう少し待ってみましょう。" },
  { minutes: 15, message: "15分到達。もう一度トントンタイムです。短くトントン、声かけだけで戻りましょう。" },
  { minutes: 20, message: "20分経過。ここまで頑張ったパパ・ママ、本当にお疲れ様です。" },
];

type TabId = "checklist" | "routine" | "timer" | "analysis";

export default function SleepTraining() {
  const [, navigate] = useLocation();
  const familyId = localStorage.getItem("familyId") || "default";
  const userId = localStorage.getItem("userType") || "papa";
  const { papaLabel, mamaLabel } = useUserLabels();
  const today = new Date().toISOString().split("T")[0];
  const [activeTab, setActiveTab] = useState<TabId>("checklist");

  const tabs: { id: TabId; label: string; icon: typeof Moon }[] = [
    { id: "checklist", label: "環境", icon: Check },
    { id: "routine", label: "ルーティン", icon: Users },
    { id: "timer", label: "タイマー", icon: Timer },
    { id: "analysis", label: "分析", icon: BarChart3 },
  ];

  const isTimerDark = activeTab === "timer";

  return (
    <div className={`min-h-screen pb-28 transition-colors duration-500 ${
      isTimerDark
        ? "bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900"
        : "bg-gradient-to-b from-indigo-50/80 via-purple-50/30 to-white"
    }`}>
      <div className="max-w-md mx-auto">
        <div className={`sticky top-0 z-40 backdrop-blur-lg border-b px-4 pt-4 pb-2 transition-colors duration-500 ${
          isTimerDark
            ? "bg-slate-900/80 border-indigo-900"
            : "bg-white/80 border-indigo-100"
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className={isTimerDark ? "text-indigo-300" : ""}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Moon className={`w-5 h-5 ${isTimerDark ? "text-indigo-400" : "text-indigo-500"}`} />
              <h1 className={`text-xl font-black ${isTimerDark ? "text-indigo-200" : "text-indigo-900"}`}>ネントレ支援</h1>
            </div>
          </div>
          <div className={`flex gap-1 p-1 rounded-2xl transition-colors duration-500 ${
            isTimerDark ? "bg-slate-800/80" : "bg-indigo-50/80"
          }`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                  activeTab === tab.id
                    ? isTimerDark
                      ? "bg-indigo-900/80 text-indigo-200 shadow-sm"
                      : "bg-white text-indigo-700 shadow-sm"
                    : isTimerDark
                      ? "text-indigo-500"
                      : "text-indigo-400"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          <AnimatePresence mode="wait">
            {activeTab === "checklist" && (
              <motion.div key="checklist" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <EnvironmentChecklist familyId={familyId} date={today} />
              </motion.div>
            )}
            {activeTab === "routine" && (
              <motion.div key="routine" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <RoutineMission familyId={familyId} userId={userId} date={today} />
              </motion.div>
            )}
            {activeTab === "timer" && (
              <motion.div key="timer" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <CryingTimer familyId={familyId} userId={userId} />
              </motion.div>
            )}
            {activeTab === "analysis" && (
              <motion.div key="analysis" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <SleepAnalysis familyId={familyId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function EnvironmentChecklist({ familyId, date }: { familyId: string; date: string }) {
  const { data: checklist, isLoading } = useSleepChecklist(familyId, date);
  const updateChecklist = useUpdateSleepChecklist();

  const allChecked = checklist?.darkness && checklist?.temperature && checklist?.safety && checklist?.whiteNoise;

  const toggleItem = (key: "darkness" | "temperature" | "safety" | "whiteNoise") => {
    const current = checklist || { darkness: false, temperature: false, safety: false, whiteNoise: false };
    updateChecklist.mutate({
      familyId,
      date,
      ...current,
      [key]: !current[key],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-indigo-50/50 border-indigo-100 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="bg-indigo-100 p-2 rounded-2xl shrink-0">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-indigo-900">環境チェック</p>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              {allChecked
                ? "環境は完璧です。この調子で毎晩チェックしましょう。赤ちゃんの安眠は環境づくりから。"
                : "寝かしつけ前に、環境をチェックしましょう。全部クリアで準備万端です。"}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = checklist?.[item.key] ?? false;
          return (
            <motion.div
              key={item.key}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`p-4 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                  isChecked ? `${item.bg} ${item.border}` : "bg-white border-gray-100"
                }`}
                onClick={() => toggleItem(item.key)}
                data-testid={`checklist-${item.key}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${isChecked ? item.bg : "bg-gray-50"}`}>
                    <item.icon className={`w-5 h-5 ${isChecked ? item.color : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${isChecked ? "text-gray-900" : "text-gray-600"}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    isChecked ? "bg-green-500 border-green-500" : "border-gray-300"
                  }`}>
                    {isChecked && <Check className="w-4 h-4 text-white stroke-[3px]" />}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {allChecked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 rounded-3xl border-2" data-testid="checklist-complete">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 p-2.5 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-black text-green-800 text-lg">環境は完璧っす！</p>
                  <p className="text-xs text-green-600 mt-0.5">安心してネントレを始められるっす！</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoutineMission({ familyId, userId, date }: { familyId: string; userId: string; date: string }) {
  const { papaLabel, mamaLabel } = useUserLabels();
  const { data: routines, isLoading: routinesLoading } = useSleepRoutines(familyId);
  const { data: routineLogs } = useSleepRoutineLogs(familyId, date);
  const completeStep = useCompleteSleepRoutineStep();
  const createRoutine = useCreateSleepRoutine();
  const deleteRoutine = useDeleteSleepRoutine();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("パパ");

  const completedIds = new Set((routineLogs || []).map((l: any) => l.routineId));
  const allDone = routines?.length > 0 && routines.every((r: any) => completedIds.has(r.id));
  const progress = routines?.length > 0 ? Math.round((completedIds.size / routines.length) * 100) : 0;

  const handleComplete = (routineId: number) => {
    completeStep.mutate({ familyId, routineId, date, completedBy: userId });
  };

  const handleAddRoutine = () => {
    if (!newTitle.trim()) return;
    const maxOrder = routines?.reduce((max: number, r: any) => Math.max(max, r.sortOrder), -1) ?? -1;
    createRoutine.mutate({
      familyId,
      title: newTitle.trim(),
      assignee: newAssignee,
      sortOrder: maxOrder + 1,
    });
    setNewTitle("");
    setNewAssignee("パパ");
    setShowAddForm(false);
  };

  if (routinesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-indigo-50/50 border-indigo-100 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="bg-indigo-100 p-2 rounded-2xl shrink-0">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-indigo-900">ルーティンのヒント</p>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              {allDone
                ? "ルーティン全完了。最高のチームワークです。3倍ポイントゲット！"
                : "毎日同じ流れを繰り返すことが、ネントレ成功の秘訣です。夫婦で分担して頑張りましょう。"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-3xl border-indigo-100">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="font-bold text-sm text-gray-700">今日の進捗</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-600">{completedIds.size}/{routines?.length || 0}</span>
            {allDone && (
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                +30pt
              </span>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <motion.div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </Card>

      <div className="space-y-2">
        {(routines || []).map((routine: any, index: number) => {
          const isDone = completedIds.has(routine.id);
          const IconComp = ROUTINE_ICONS[routine.title] || Moon;
          const assigneeColor = routine.assignee === "パパ" ? "text-blue-600 bg-blue-50" : routine.assignee === "ママ" ? "text-pink-600 bg-pink-50" : "text-gray-600 bg-gray-50";
          const assigneeDisplay = routine.assignee === "パパ" ? papaLabel : routine.assignee === "ママ" ? mamaLabel : routine.assignee;

          return (
            <motion.div
              key={routine.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`p-3.5 rounded-2xl border-2 transition-all duration-300 ${
                  isDone ? "bg-green-50/50 border-green-200" : "bg-white border-gray-100"
                }`}
                data-testid={`routine-step-${routine.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isDone ? "bg-green-100" : "bg-indigo-50"}`}>
                    <IconComp className={`w-4 h-4 ${isDone ? "text-green-600" : "text-indigo-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-bold text-sm ${isDone ? "text-green-700 line-through" : "text-gray-800"}`}>
                        {routine.title}
                      </p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${assigneeColor}`}>
                        {assigneeDisplay}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDone ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleComplete(routine.id)}
                        disabled={completeStep.isPending}
                        className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold"
                        data-testid={`button-complete-routine-${routine.id}`}
                      >
                        {completeStep.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                        完了
                      </Button>
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteRoutine.mutate(routine.id)}
                      className="text-gray-400 hover:text-red-500"
                      data-testid={`button-delete-routine-${routine.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {!showAddForm ? (
        <Button
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-2xl border-dashed border-2 border-indigo-200 text-indigo-500 hover:bg-indigo-50 font-bold"
          data-testid="button-add-routine"
        >
          <Plus className="w-4 h-4 mr-2" />
          ステップを追加
        </Button>
      ) : (
        <Card className="p-4 rounded-2xl border-indigo-200 border-2 space-y-3">
          <div className="space-y-2">
            <Label className="font-bold text-xs">ステップ名</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例：歯磨き"
              className="rounded-xl"
              data-testid="input-routine-title"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-xs">担当</Label>
            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="rounded-xl" data-testid="select-routine-assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="パパ">{papaLabel}</SelectItem>
                <SelectItem value="ママ">{mamaLabel}</SelectItem>
                <SelectItem value="未定">未定</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowAddForm(false); setNewTitle(""); }}
              className="flex-1 rounded-xl font-bold"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAddRoutine}
              disabled={!newTitle.trim()}
              className="flex-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold"
              data-testid="button-save-routine"
            >
              追加する
            </Button>
          </div>
        </Card>
      )}

      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 rounded-3xl border-2" data-testid="routine-complete">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 p-2.5 rounded-2xl">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-black text-indigo-800 text-lg">ルーティン完了！</p>
                  <p className="text-xs text-indigo-600 mt-0.5">チーム3倍ポイント +30pt 獲得！</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CHECK_IN_OPTIONS = [
  { value: 3, label: "3分" },
  { value: 5, label: "5分" },
  { value: 7, label: "7分" },
  { value: 10, label: "10分" },
];

const ENCOURAGEMENT_MESSAGES = [
  "今、お子様は自分で眠る力を育んでいるところっす！おふたりで温かく見守ってあげてくださいっす！",
  "つらくなったら、パートナーとそっと手を取り合ってくださいっす！おふたりの絆が一番の力っすよ！",
  "これはお子様への素敵な贈り物っす！自分で眠れる力は一生の宝物っす！",
  "大丈夫っす！お子様は安心できるお部屋にいるっす！パパとママを信頼しているっすよ！",
  "おふたりで一緒に乗り越えるっす！今夜の頑張りが、穏やかな明日につながるっす！",
];

function CryingTimer({ familyId, userId }: { familyId: string; userId: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [checkInInterval, setCheckInInterval] = useState(5);
  const [isObserving, setIsObserving] = useState(false);
  const [observeElapsed, setObserveElapsed] = useState(0);
  const [sleepRecorded, setSleepRecorded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const observeRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    if (isObserving) {
      observeRef.current = setInterval(() => {
        setObserveElapsed((prev) => prev + 1);
      }, 1000);
    } else if (observeRef.current) {
      clearInterval(observeRef.current);
    }
    return () => {
      if (observeRef.current) clearInterval(observeRef.current);
    };
  }, [isObserving]);

  useEffect(() => {
    const elapsedMinutes = elapsed / 60;
    let phase = 0;
    for (let i = TIMER_PHASES.length - 1; i >= 0; i--) {
      if (elapsedMinutes >= TIMER_PHASES[i].minutes) {
        phase = i;
        break;
      }
    }
    setCurrentPhase(phase);
  }, [elapsed]);

  const handleStart = () => {
    setIsRunning(true);
    setSleepRecorded(false);
  };
  const handleStop = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setElapsed(0);
    setCurrentPhase(0);
    setIsObserving(false);
    setObserveElapsed(0);
    setSleepRecorded(false);
  };

  const handleObserve = () => {
    setIsRunning(false);
    setIsObserving(true);
    setObserveElapsed(0);
  };

  const handleObserveEnd = () => {
    setIsObserving(false);
    setObserveElapsed(0);
    setIsRunning(true);
  };

  const handleSleepSuccess = async () => {
    setIsRunning(false);
    setIsObserving(false);
    setIsSaving(true);
    try {
      const childId = localStorage.getItem("activeChildId");
      const res = await fetch("/api/sleep-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId,
          userId,
          childId: childId ? parseInt(childId) : null,
          elapsedMinutes: Math.floor(elapsed / 60),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSleepRecorded(true);
    } catch {
      setSleepRecorded(false);
    } finally {
      setIsSaving(false);
    }
  };

  const checkInSeconds = checkInInterval * 60;
  const secsUntilCheckIn = elapsed > 0 ? checkInSeconds - (elapsed % checkInSeconds) : checkInSeconds;
  const isCheckInSoon = secsUntilCheckIn <= 120 && secsUntilCheckIn > 0 && elapsed > 0 && secsUntilCheckIn < checkInSeconds;
  const isCheckInNow = secsUntilCheckIn <= 5 && elapsed > 0;

  const elapsedMinutes = Math.floor(elapsed / 60);
  const encouragementIdx = Math.floor(elapsed / 60) % ENCOURAGEMENT_MESSAGES.length;

  if (sleepRecorded) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center py-12"
        >
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-indigo-900/50 border-2 border-indigo-400/30 mb-6">
            <Moon className="w-14 h-14 text-indigo-300" />
          </div>
          <h2 className="text-2xl font-black text-indigo-200 mb-2">おやすみなさい</h2>
          <p className="text-sm text-indigo-400 mb-1">
            {Math.floor(elapsed / 60)}分{elapsed % 60}秒で入眠しました
          </p>
          <p className="text-xs text-indigo-500">
            タイムラインに記録済み・パートナーに通知しました
          </p>
        </motion.div>
        <Button
          onClick={handleReset}
          className="w-full rounded-[20px] font-bold py-5 bg-indigo-800/60 border border-indigo-600/30 text-indigo-200"
          data-testid="button-timer-new-session"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          新しいセッションを始める
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-indigo-950/60 border border-indigo-800/50 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="bg-indigo-800/60 p-2 rounded-2xl shrink-0">
            <Moon className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-indigo-200">使い方</p>
            <p className="text-xs text-indigo-400 mt-1 leading-relaxed">
              赤ちゃんを布団に置いてからスタート。設定した間隔で様子を見に行くタイミングをお知らせします。
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 rounded-2xl bg-slate-800/60 border border-indigo-900/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-indigo-300">様子見の間隔</span>
          </div>
          <div className="flex gap-1">
            {CHECK_IN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCheckInInterval(opt.value)}
                disabled={isRunning}
                data-testid={`button-interval-${opt.value}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  checkInInterval === opt.value
                    ? "bg-indigo-600 text-indigo-100"
                    : "bg-slate-700/60 text-indigo-400"
                } ${isRunning ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-3xl border-2 border-indigo-800/50 bg-slate-800/40 text-center">
        <div className="mb-6">
          <motion.div
            animate={isRunning ? { boxShadow: ["0 0 20px rgba(99,102,241,0.2)", "0 0 40px rgba(99,102,241,0.4)", "0 0 20px rgba(99,102,241,0.2)"] } : {}}
            transition={isRunning ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : {}}
            className={`inline-flex items-center justify-center w-44 h-44 rounded-full border-4 transition-all duration-500 ${
              isCheckInNow ? "border-amber-500/80 bg-amber-900/20" :
              isCheckInSoon ? "border-amber-500/50 bg-amber-950/20" :
              isObserving ? "border-emerald-500/50 bg-emerald-950/20" :
              isRunning ? "border-indigo-500/50 bg-indigo-950/30" : "border-indigo-800/40 bg-slate-800/40"
            }`}
          >
            <span className={`font-black text-5xl font-mono tracking-wider ${
              isCheckInNow ? "text-amber-300" :
              isCheckInSoon ? "text-amber-400" :
              isObserving ? "text-emerald-300" :
              isRunning ? "text-indigo-200" : "text-indigo-500"
            }`} data-testid="text-timer-display">
              {isObserving ? formatTime(observeElapsed) : formatTime(elapsed)}
            </span>
          </motion.div>
        </div>

        {isObserving && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/50"
            data-testid="text-observe-status"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-300">様子見中</span>
            </div>
            <p className="text-xs text-emerald-400/80">
              短くトントン・声かけだけで戻りましょう。抱っこは我慢。
            </p>
          </motion.div>
        )}

        {isRunning && elapsed > 0 && !isObserving && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-3 rounded-2xl border ${
              isCheckInNow
                ? "bg-amber-900/30 border-amber-600/50"
                : isCheckInSoon
                  ? "bg-amber-950/30 border-amber-800/40"
                  : "bg-indigo-950/30 border-indigo-800/40"
            }`}
            data-testid="text-checkin-countdown"
          >
            <div className="flex items-center justify-center gap-2">
              <Bell className={`w-4 h-4 ${
                isCheckInNow ? "text-amber-300 animate-bounce" :
                isCheckInSoon ? "text-amber-400 animate-pulse" : "text-indigo-400"
              }`} />
              <span className={`text-sm font-bold ${
                isCheckInNow ? "text-amber-200" :
                isCheckInSoon ? "text-amber-300" : "text-indigo-300"
              }`}>
                {isCheckInNow
                  ? "様子を見に行きましょう"
                  : isCheckInSoon
                    ? `あと ${formatTime(secsUntilCheckIn)} で様子見の時間`
                    : `次の様子見まで ${formatTime(secsUntilCheckIn)}`
                }
              </span>
            </div>
          </motion.div>
        )}

        {!isObserving && (
          <div className="space-y-3 mb-2">
            {!isRunning && elapsed === 0 && (
              <Button
                onClick={handleStart}
                className="w-full rounded-2xl bg-indigo-600 text-indigo-100 font-bold py-5 text-base"
                data-testid="button-timer-start"
              >
                <Play className="w-5 h-5 mr-2" />
                スタート
              </Button>
            )}

            {!isRunning && elapsed > 0 && !sleepRecorded && (
              <Button
                onClick={handleStart}
                className="w-full rounded-2xl bg-indigo-700/60 border border-indigo-600/40 text-indigo-200 font-bold py-5 text-base"
                data-testid="button-timer-start"
              >
                <Play className="w-5 h-5 mr-2" />
                再開
              </Button>
            )}

            {isRunning && (
              <>
                <Button
                  onClick={handleStop}
                  className="w-full rounded-2xl bg-slate-700/60 border border-slate-600/40 text-slate-200 font-bold py-4"
                  data-testid="button-timer-stop"
                >
                  <Square className="w-4 h-4 mr-2" />
                  一時停止（確認・中断）
                </Button>

                {(isCheckInSoon || isCheckInNow) && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                    <Button
                      onClick={handleObserve}
                      className="w-full rounded-2xl bg-amber-800/40 border border-amber-600/40 text-amber-200 font-bold py-4"
                      data-testid="button-timer-observe"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      様子を見る（介入タイマー）
                    </Button>
                  </motion.div>
                )}
              </>
            )}

            {elapsed > 0 && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <Button
                  onClick={handleSleepSuccess}
                  disabled={isSaving}
                  className="w-full rounded-[20px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black py-6 text-lg shadow-lg shadow-indigo-900/30"
                  data-testid="button-sleep-success"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Moon className="w-5 h-5 mr-2" />
                  )}
                  寝た（入眠成功）
                </Button>
              </motion.div>
            )}

            {elapsed > 0 && !isRunning && (
              <Button
                onClick={handleReset}
                variant="ghost"
                className="w-full text-indigo-500 font-bold"
                data-testid="button-timer-reset"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                リセット
              </Button>
            )}
          </div>
        )}

        {isObserving && (
          <div className="space-y-3">
            <Button
              onClick={handleObserveEnd}
              className="w-full rounded-2xl bg-emerald-700/40 border border-emerald-600/40 text-emerald-200 font-bold py-4"
              data-testid="button-observe-end"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              見守り終了・タイマーに戻る
            </Button>
            <Button
              onClick={handleSleepSuccess}
              disabled={isSaving}
              className="w-full rounded-[20px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black py-6 text-lg shadow-lg shadow-indigo-900/30"
              data-testid="button-sleep-success-observe"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Moon className="w-5 h-5 mr-2" />
              )}
              寝た（入眠成功）
            </Button>
          </div>
        )}
      </Card>

      <AnimatePresence mode="wait">
        {(isRunning || elapsed > 0) && !isObserving && (
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 bg-indigo-950/50 border border-indigo-800/40 rounded-3xl" data-testid="text-timer-message">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-700/50 p-2 rounded-2xl shrink-0">
                  <Zap className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm text-indigo-200">ねんねコーチング</p>
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-900/60 px-1.5 py-0.5 rounded-full">
                      {TIMER_PHASES[currentPhase].minutes}分
                    </span>
                  </div>
                  <p className="text-sm text-indigo-300/80 leading-relaxed font-medium">
                    {TIMER_PHASES[currentPhase].message}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isRunning && elapsed >= 60 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="p-4 bg-purple-950/40 border border-purple-800/40 rounded-3xl" data-testid="text-encouragement">
            <div className="flex items-start gap-3">
              <div className="bg-purple-700/50 p-2 rounded-2xl shrink-0">
                <Star className="w-5 h-5 text-purple-300" />
              </div>
              <div>
                <p className="font-bold text-sm text-purple-200 mb-1">応援メッセージ</p>
                <p className="text-xs text-purple-300/80 leading-relaxed font-medium">
                  {ENCOURAGEMENT_MESSAGES[encouragementIdx]}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <Card className="p-4 rounded-3xl bg-slate-800/40 border border-indigo-900/40">
        <p className="font-bold text-sm text-indigo-300 mb-3">メソッド一覧</p>
        <div className="space-y-2">
          {TIMER_PHASES.map((phase, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                currentPhase === i && (isRunning || elapsed > 0)
                  ? "bg-indigo-900/40 border border-indigo-700/40"
                  : ""
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentPhase >= i && (isRunning || elapsed > 0)
                  ? "bg-indigo-600 text-indigo-100"
                  : "bg-slate-700/60 text-indigo-500"
              }`}>
                {currentPhase > i && (isRunning || elapsed > 0) ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <p className={`text-xs ${
                currentPhase === i && (isRunning || elapsed > 0) ? "font-bold text-indigo-200" : "text-indigo-500"
              }`}>
                {phase.minutes}分 - {phase.message.substring(0, 30)}...
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SleepTimeline({ sessions }: { sessions: any[] }) {
  const sleepBlocks = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const blocks: { startHour: number; endHour: number; durationMin: number; isNight: boolean }[] = [];

    sessions
      .filter((s: any) => s.endedAt)
      .forEach((s: any) => {
        const start = new Date(s.startedAt);
        const end = new Date(s.endedAt);
        const clippedStart = start < dayStart ? dayStart : start;
        const clippedEnd = end > dayEnd ? dayEnd : end;
        if (clippedStart >= clippedEnd) return;

        const startHour = clippedStart.getHours() + clippedStart.getMinutes() / 60;
        const endHour = clippedEnd.getHours() + clippedEnd.getMinutes() / 60;
        const durationMin = Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 60000);
        const isNight = start.getHours() >= 19 || start.getHours() < 7;
        blocks.push({ startHour, endHour: endHour === 0 ? 24 : endHour, durationMin, isNight });
      });

    return blocks;
  }, [sessions]);

  const totalSleepMin = sleepBlocks.reduce((sum, b) => sum + b.durationMin, 0);
  const totalHours = Math.floor(totalSleepMin / 60);
  const totalMins = totalSleepMin % 60;

  return (
    <Card className="p-4 rounded-3xl" data-testid="chart-sleep-timeline">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-sm text-gray-700">24時間スリープタイムライン</p>
        <span className="text-xs font-bold text-indigo-500">{totalHours}h{totalMins > 0 ? `${totalMins}m` : ""}</span>
      </div>
      <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
        {sleepBlocks.map((block, i) => {
          const left = (block.startHour / 24) * 100;
          const width = Math.max(((block.endHour - block.startHour) / 24) * 100, 1);
          return (
            <div
              key={i}
              className={`absolute top-0 h-full rounded-md ${block.isNight ? 'bg-indigo-500' : 'bg-indigo-300'}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${Math.floor(block.startHour)}:${String(Math.round((block.startHour % 1) * 60)).padStart(2, '0')} - ${Math.floor(block.endHour)}:${String(Math.round((block.endHour % 1) * 60)).padStart(2, '0')} (${block.durationMin}分)`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className="text-[9px] text-gray-400 font-bold">{h === 24 ? '0' : h}時</span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-indigo-500" />
          <span className="text-[10px] text-gray-500 font-bold">夜(19-7時)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-indigo-300" />
          <span className="text-[10px] text-gray-500 font-bold">昼寝</span>
        </div>
      </div>
    </Card>
  );
}

function SleepAnalysis({ familyId }: { familyId: string }) {
  const { data: allLogs, isLoading: logsLoading } = useLogs(familyId);
  const { data: routines } = useSleepRoutines(familyId);
  const { data: allSleepSessions = [] } = useSleepSessions(familyId);

  const activeChildId = localStorage.getItem("activeChildId") ? parseInt(localStorage.getItem("activeChildId")!) : null;
  const logs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);
  const sleepSessions = useMemo(() => {
    if (!activeChildId) return allSleepSessions;
    return allSleepSessions.filter((s: any) => !s.childId || s.childId === activeChildId);
  }, [allSleepSessions, activeChildId]);

  const weekDates = useMemo(() => {
    const now = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
    return dates;
  }, []);

  const { data: weekRoutineLogs, isLoading: routineLogsLoading, isError: routineLogsError } = useQuery({
    queryKey: ["/api/sleep/routine-logs-week", familyId, weekDates[0]],
    queryFn: async () => {
      const results = await Promise.all(
        weekDates.map(async (date) => {
          try {
            const res = await fetch(`/api/sleep/routine-logs/${familyId}/${date}`);
            if (!res.ok) return { date, logs: [] };
            const data = await res.json();
            return { date, logs: Array.isArray(data) ? data : [] };
          } catch {
            return { date, logs: [] };
          }
        })
      );
      return results;
    },
    retry: 1,
  });

  const isLoading = logsLoading || routineLogsLoading;
  const totalRoutines = routines?.length || 0;

  const weeklyData = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    const now = new Date();
    const days: { date: string; label: string; sleepCount: number; nightWakings: number; routineComplete: boolean }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${day}`;
      const dayLabel = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];

      const dayLogs = logs.filter((l: any) => {
        const logD = new Date(l.createdAt);
        const ly = logD.getFullYear();
        const lm = String(logD.getMonth() + 1).padStart(2, "0");
        const ld = String(logD.getDate()).padStart(2, "0");
        return `${ly}-${lm}-${ld}` === dateStr;
      });

      const sleepCount = dayLogs.filter((l: any) => l.type === "sleep").length;

      const nightWakings = dayLogs.filter((l: any) => {
        if (l.type !== "sleep") return false;
        const h = new Date(l.createdAt).getHours();
        return h >= 0 && h < 6;
      }).length;

      const dayRoutineLogs = weekRoutineLogs?.find((r) => r.date === dateStr)?.logs || [];
      const routineComplete = totalRoutines > 0 && dayRoutineLogs.length >= totalRoutines;

      days.push({
        date: dateStr,
        label: dayLabel,
        sleepCount,
        nightWakings,
        routineComplete,
      });
    }

    return days;
  }, [logs, weekRoutineLogs, totalRoutines]);

  const totalSleepLogs = weeklyData.reduce((sum, d) => sum + d.sleepCount, 0);
  const totalNightWakings = weeklyData.reduce((sum, d) => sum + d.nightWakings, 0);
  const consistentDays = weeklyData.filter((d) => d.routineComplete).length;
  const avgNightWakings = weeklyData.length > 0 ? (totalNightWakings / 7).toFixed(1) : "0";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6 rounded-3xl text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-sm text-gray-600">まだデータがありません</p>
          <p className="text-xs text-gray-400 mt-1">ねんねを記録すると、ここに分析が表示されます</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-indigo-50/50 border-indigo-100 rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="bg-indigo-100 p-2 rounded-2xl shrink-0">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-indigo-900">週間分析</p>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              {consistentDays >= 5
                ? "この1週間、素晴らしいです。ルーティンが定着してきています。最高のチームワークですね。"
                : consistentDays >= 3
                ? "いい感じです。ルーティンを続けることが大事です。もう少しで習慣化しますよ。"
                : "ルーティンを毎日続けると、睡眠パターンが安定します。夫婦で頑張りましょう。"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 rounded-2xl text-center" data-testid="stat-total-sleep">
          <Moon className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-800">{totalSleepLogs}</p>
          <p className="text-[10px] font-bold text-gray-400">ねんね記録</p>
        </Card>
        <Card className="p-3 rounded-2xl text-center" data-testid="stat-night-wakings">
          <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-800">{avgNightWakings}</p>
          <p className="text-[10px] font-bold text-gray-400">平均夜泣き/日</p>
        </Card>
        <Card className="p-3 rounded-2xl text-center" data-testid="stat-consistent-days">
          <Star className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-black text-gray-800">{consistentDays}</p>
          <p className="text-[10px] font-bold text-gray-400">ルーティン達成</p>
        </Card>
      </div>

      <Card className="p-4 rounded-3xl" data-testid="chart-sleep-logs">
        <p className="font-bold text-sm text-gray-700 mb-3">1週間のねんね記録</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#999" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  `${value}回`,
                  name === "sleepCount" ? "ねんね" : "夜泣き",
                ]}
                labelFormatter={(label: string) => `${label}曜日`}
              />
              <Bar dataKey="sleepCount" fill="#818cf8" radius={[6, 6, 0, 0]} name="sleepCount" />
              <Bar dataKey="nightWakings" fill="#fbbf24" radius={[6, 6, 0, 0]} name="nightWakings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-indigo-400" />
            <span className="text-[10px] text-gray-500 font-bold">ねんね</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span className="text-[10px] text-gray-500 font-bold">夜泣き(0-6時)</span>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-3xl" data-testid="chart-routine-consistency">
        <p className="font-bold text-sm text-gray-700 mb-3">ルーティン達成カレンダー</p>
        <div className="grid grid-cols-7 gap-2">
          {weeklyData.map((day) => (
            <div key={day.date} className="text-center">
              <p className="text-[10px] font-bold text-gray-400 mb-1">{day.label}</p>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto border-2 transition-all ${
                day.routineComplete
                  ? "bg-green-50 border-green-300"
                  : "bg-gray-50 border-gray-200"
              }`}>
                {day.routineComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
              </div>
            </div>
          ))}
        </div>
        {consistentDays >= 5 && (
          <div className="mt-3 p-2 bg-green-50 rounded-xl border border-green-200">
            <p className="text-xs font-bold text-green-700 text-center">
              週5日以上達成！ボーナスポイント対象っす！
            </p>
          </div>
        )}
      </Card>

      {sleepSessions.length > 0 && (
        <SleepTimeline sessions={sleepSessions} />
      )}
    </div>
  );
}
