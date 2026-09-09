import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Loader2, Users, User, Baby, Cake, Crown, Copy, Check, MessageSquare, Share2, Plus, Palette, Trash2, LayoutGrid, Info, ChevronRight, LogOut, BookOpen, Star, Heart, HandHeart, Scissors, Brush, Bike, Package, Lamp, Pill, Thermometer, BellRing, Sun, Moon, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BottomNav } from "@/components/Navigation";
import { useSettings, useUpdateSettings, useChildren, useCreateChild, useDeleteChild, useCustomChildcareItems, useDeleteCustomChildcareItem } from "@/hooks/use-app-data";
import { useTheme, ThemeMode } from "@/hooks/use-theme";
import { setActiveChildIdGlobal } from "@/hooks/use-active-child";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import { useUserType, setUserTypeGlobal } from "@/hooks/use-user-type";
import { useUserLabels } from "@/hooks/use-user-labels";
import { phases, getPhaseForAge, getActionsForPhase, PhaseActionConfig } from "@/lib/phases";

const settingsSchema = z.object({
  familyId: z.string().min(3, "家族IDは3文字以上で入力してください"),
  babyName: z.string().min(1, "名前を入力してください"),
  babyBirthday: z.string().optional(),
  specialTrick: z.string().optional(),
  currentCaregiver: z.string().min(1, "担当者を選択してください"),
});

type SettingsForm = z.infer<typeof settingsSchema>;

function PairingSection({ familyId }: { familyId: string }) {
  const [copied, setCopied] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(familyId);
      setCopied(true);
      toast({
        title: "コピーしました",
        description: "パートナーにこのコードを共有してください",
        className: "bg-green-50 border-green-100 text-green-900",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "コピーに失敗しました", variant: "destructive" });
    }
  };

  const handleJoin = () => {
    if (joinCode.length >= 3) {
      localStorage.setItem("familyId", joinCode);
      localStorage.setItem("onboarding_done", "true");
      toast({
        title: "ペアリング完了",
        description: "パートナーのデータと同期します",
        className: "bg-green-50 border-green-100 text-green-900",
      });
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-green-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <Share2 className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-700">ペアリング</p>
          <p className="text-[10px] text-gray-400">パートナーとデータを共有</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs font-bold text-gray-500 mb-1.5 block">あなたのペアリングコード</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-mono text-lg font-black text-purple-600 tracking-wider select-all" data-testid="text-pairing-code">
              {familyId}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="rounded-xl border-2 shrink-0"
              data-testid="button-copy-pairing-code"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">このコードをパートナーに共有してください</p>
        </div>

        {!joinMode ? (
          <Button
            variant="outline"
            onClick={() => setJoinMode(true)}
            className="w-full rounded-xl border-2"
            data-testid="button-join-partner"
          >
            <Users className="w-4 h-4 mr-2" />
            パートナーのコードで参加する
          </Button>
        ) : (
          <div className="space-y-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="パートナーのコードを入力"
              className="rounded-xl border-2 h-12 font-mono text-lg"
              data-testid="input-join-code"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setJoinMode(false)}
                className="flex-1 rounded-xl"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleJoin}
                disabled={joinCode.length < 3}
                className="flex-1 rounded-xl"
                data-testid="button-join-submit"
              >
                参加する
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FeedingNotificationSection() {
  const [enabled, setEnabled] = useState(localStorage.getItem("feedingNotifyEnabled") === "true");
  const [minutesBefore, setMinutesBefore] = useState(
    parseInt(localStorage.getItem("feedingNotifyMinutes") || "10", 10)
  );
  const [targetIntervalMin, setTargetIntervalMin] = useState(
    parseInt(localStorage.getItem("feedingTargetIntervalMin") || "0", 10)
  );
  const [permissionState, setPermissionState] = useState<string>(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const { toast } = useToast();

  const handleIntervalChange = (val: number) => {
    setTargetIntervalMin(val);
    localStorage.setItem("feedingTargetIntervalMin", String(val));
  };

  const INTERVAL_OPTIONS: { label: string; value: number }[] = [
    { label: "自動", value: 0 },
    { label: "2時間", value: 120 },
    { label: "2.5時間", value: 150 },
    { label: "3時間", value: 180 },
    { label: "3.5時間", value: 210 },
    { label: "4時間", value: 240 },
    { label: "5時間", value: 300 },
    { label: "6時間", value: 360 },
  ];

  const handleToggle = async (val: boolean) => {
    if (val && permissionState !== "granted") {
      if (!("Notification" in window)) {
        toast({ title: "このブラウザは通知に対応していません" });
        return;
      }
      const result = await Notification.requestPermission();
      setPermissionState(result);
      if (result !== "granted") {
        toast({ title: "通知の許可が必要です", description: "ブラウザの設定から通知を許可してください" });
        return;
      }
    }
    setEnabled(val);
    localStorage.setItem("feedingNotifyEnabled", val ? "true" : "false");
    toast({ title: val ? "授乳アラームを有効にしました" : "授乳アラームをオフにしました" });
  };

  const handleMinutesChange = (val: number) => {
    setMinutesBefore(val);
    localStorage.setItem("feedingNotifyMinutes", String(val));
  };

  const TIMING_OPTIONS = [5, 10, 15, 20, 30];

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-pink-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
          <BellRing className="w-5 h-5 text-pink-500" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-700">授乳アラーム</p>
          <p className="text-[10px] text-gray-400">次回授乳の予定時刻の前に通知</p>
        </div>
      </div>

      {/* 目標授乳間隔 */}
      <div className="mb-4 space-y-2">
        <div>
          <p className="text-sm font-bold text-gray-700">目標授乳間隔</p>
          <p className="text-[10px] text-gray-400">「自動」は過去の授乳記録の平均から計算します</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleIntervalChange(opt.value)}
              data-testid={`button-interval-${opt.value}`}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${
                targetIntervalMin === opt.value
                  ? "bg-pink-500 border-pink-500 text-white"
                  : "bg-white border-gray-100 text-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-bold text-gray-700">アラームを有効にする</p>
          {permissionState === "denied" && (
            <p className="text-[10px] text-red-500 mt-0.5">通知がブロックされています。ブラウザの設定で許可してください。</p>
          )}
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          data-testid="switch-feeding-notify"
        />
      </div>

      {enabled && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-bold text-gray-500">何分前に通知しますか？</p>
          <div className="flex flex-wrap gap-2">
            {TIMING_OPTIONS.map((min) => (
              <button
                key={min}
                onClick={() => handleMinutesChange(min)}
                data-testid={`button-notify-${min}min`}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                  minutesBefore === min
                    ? "bg-pink-500 border-pink-500 text-white"
                    : "bg-white border-gray-100 text-gray-600"
                }`}
              >
                {min}分前
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 pt-1">
            アプリを開いている間のみ通知されます。
            過去の授乳間隔から次回授乳時刻を予測します。
          </p>
        </div>
      )}
    </section>
  );
}

function ThemeSection() {
  const { mode, setMode, autoStart, autoEnd, setAutoHours } = useTheme();

  const options: { value: ThemeMode; label: string; description: string; icon: JSX.Element }[] = [
    {
      value: "light",
      label: "ライト",
      description: "常に明るい画面",
      icon: <Sun className="w-5 h-5 text-amber-500" />,
    },
    {
      value: "dark",
      label: "ダーク",
      description: "常に暗い画面",
      icon: <Moon className="w-5 h-5 text-indigo-400" />,
    },
    {
      value: "auto",
      label: "自動",
      description: `${autoStart}時〜${autoEnd}時はダーク`,
      icon: <Clock className="w-5 h-5 text-purple-500" />,
    },
  ];

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <section className="bg-card backdrop-blur-sm p-6 rounded-[24px] shadow-sm border border-border space-y-4" data-testid="section-theme">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <Moon className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <p className="text-base font-bold text-foreground">画面の明るさ</p>
          <p className="text-[10px] text-muted-foreground">夜間の目への負担を軽減できます</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const selected = mode === opt.value;
          return (
            <button
              key={opt.value}
              data-testid={`button-theme-${opt.value}`}
              onClick={() => setMode(opt.value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                selected
                  ? "border-purple-400 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-500"
                  : "border-border bg-muted/40 dark:bg-muted/20"
              }`}
            >
              {opt.icon}
              <span className={`text-xs font-bold ${selected ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground"}`}>
                {opt.label}
              </span>
              <span className="text-[9px] text-muted-foreground text-center leading-tight">{opt.description}</span>
            </button>
          );
        })}
      </div>

      {mode === "auto" && (
        <div className="bg-muted/40 dark:bg-muted/20 rounded-2xl p-4 space-y-3" data-testid="section-auto-hours">
          <p className="text-xs font-bold text-foreground">ダークモードにする時間帯</p>
          <div className="flex items-center gap-2">
            <select
              data-testid="select-auto-start"
              value={autoStart}
              onChange={(e) => setAutoHours(parseInt(e.target.value, 10), autoEnd)}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>{h}時</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">から</span>
            <select
              data-testid="select-auto-end"
              value={autoEnd}
              onChange={(e) => setAutoHours(autoStart, parseInt(e.target.value, 10))}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>{h}時</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">まで</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            開始が終了より遅い場合は日をまたいで適用されます（例：22時〜7時）
          </p>
        </div>
      )}
    </section>
  );
}

function FeatureToggleSection() {
  const [showWeBoard, setShowWeBoard] = useState(() => localStorage.getItem("showWeBoard") !== "false");
  const [showSkillTree, setShowSkillTree] = useState(() => localStorage.getItem("showSkillTree") !== "false");

  const handleWeBoard = (val: boolean) => {
    localStorage.setItem("showWeBoard", String(val));
    setShowWeBoard(val);
  };

  const handleSkillTree = (val: boolean) => {
    localStorage.setItem("showSkillTree", String(val));
    setShowSkillTree(val);
  };

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border border-purple-50 space-y-4" data-testid="section-feature-toggles">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <LayoutGrid className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-700">表示設定</p>
          <p className="text-[10px] text-gray-400">ホーム画面に表示する機能を選べます</p>
        </div>
      </div>

      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <div>
          <p className="text-sm font-bold text-gray-700">Weボード</p>
          <p className="text-xs text-gray-400">パートナーへの一言ボード</p>
        </div>
        <Switch
          checked={showWeBoard}
          onCheckedChange={handleWeBoard}
          data-testid="switch-show-weboard"
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-bold text-gray-700">チーム育児スキル</p>
          <p className="text-xs text-gray-400">ふたりの経験値・スキルツリー</p>
        </div>
        <Switch
          checked={showSkillTree}
          onCheckedChange={handleSkillTree}
          data-testid="switch-show-skilltree"
        />
      </div>
    </section>
  );
}

function FeedbackSection() {
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const familyId = localStorage.getItem("familyId") || "default";
  const userType = localStorage.getItem("userType") || "papa";

  const feedbackMutation = useMutation({
    mutationFn: async (data: { familyId: string; userId: string; message: string }) => {
      const res = await apiRequest("POST", "/api/feedbacks", data);
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      toast({
        title: "ご意見をお送りしました",
        description: "改善のために活用させていただきます。ありがとうございます！",
        className: "bg-green-50 border-green-100 text-green-900",
      });
    },
    onError: () => {
      toast({
        title: "送信に失敗しました",
        description: "もう一度お試しください",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) return;
    feedbackMutation.mutate({
      familyId,
      userId: userType,
      message: message.trim(),
    });
  };

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-amber-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-700">改善提案を送る</p>
          <p className="text-[10px] text-gray-400">開発チームに直接届きます</p>
        </div>
      </div>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="使いにくい点や欲しい機能など、何でもお聞かせください..."
        className="rounded-xl border-2 border-gray-100 min-h-[100px] text-sm"
        data-testid="textarea-feedback"
      />
      <Button
        onClick={handleSubmit}
        disabled={!message.trim() || feedbackMutation.isPending}
        className="w-full h-12 rounded-xl mt-3 font-bold"
        data-testid="button-send-feedback"
      >
        {feedbackMutation.isPending
          ? <Loader2 key="loading" className="w-4 h-4 animate-spin mr-2" />
          : <MessageSquare key="icon" className="w-4 h-4 mr-2" />
        }
        送信する
      </Button>
    </section>
  );
}

function getAgeInMonths(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

function getAllUniqueActions(): PhaseActionConfig[] {
  const seen = new Set<string>();
  const all: PhaseActionConfig[] = [];
  for (const phase of phases) {
    for (const action of phase.actions) {
      if (!seen.has(action.id)) {
        seen.add(action.id);
        all.push(action);
      }
    }
  }
  return all;
}

function ButtonCustomizationSection({ activeChild }: { activeChild: any }) {
  const { toast } = useToast();
  const rawChildIdStr = localStorage.getItem("activeChildId");
  const childId = activeChild?.id ?? (rawChildIdStr ? parseInt(rawChildIdStr) : null);
  const birthday = activeChild?.birthday;
  const ageMonths = getAgeInMonths(birthday);
  const detectedPhase = ageMonths !== null ? getPhaseForAge(ageMonths) : 0;
  const phaseDef = phases.find((p) => p.id === detectedPhase) || phases[0];
  const phaseActions = getActionsForPhase(detectedPhase);
  const allActions = useMemo(() => getAllUniqueActions(), []);

  const storageKey = childId ? `phase_button_overrides_${childId}` : null;

  const [enabledIds, setEnabledIds] = useState<string[]>(() => {
    if (!storageKey) return phaseActions.map((a) => a.id);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return phaseActions.map((a) => a.id);
  });

  const [showOtherPhases, setShowOtherPhases] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try { setEnabledIds(JSON.parse(stored)); return; } catch { /* ignore */ }
    }
    setEnabledIds(phaseActions.map((a) => a.id));
  }, [storageKey, detectedPhase]);

  const otherPhaseActions = useMemo(() => {
    const currentIds = new Set(phaseActions.map((a) => a.id));
    return allActions.filter((a) => !currentIds.has(a.id));
  }, [detectedPhase, allActions]);

  const persistIds = (newIds: string[]) => {
    setEnabledIds(newIds);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newIds));
    }
    toast({ title: "ボタン設定を保存しました", className: "bg-green-50 border-green-100 text-green-900" });
  };

  const toggleAction = (actionId: string) => {
    const newIds = enabledIds.includes(actionId)
      ? enabledIds.filter((id) => id !== actionId)
      : [...enabledIds, actionId];
    persistIds(newIds);
  };

  const addFromOtherPhase = (actionId: string) => {
    if (!enabledIds.includes(actionId)) persistIds([...enabledIds, actionId]);
  };

  const resetToDefault = () => {
    persistIds(phaseActions.map((a) => a.id));
    setShowOtherPhases(false);
  };

  const enabledActions = enabledIds
    .map((id) => allActions.find((a) => a.id === id))
    .filter(Boolean) as typeof phaseActions;

  const disabledPhaseActions = phaseActions.filter((a) => !enabledIds.includes(a.id));

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-indigo-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
          <LayoutGrid className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-gray-700" data-testid="text-button-customization-title">表示するボタン</p>
          <p className="text-[10px] text-gray-400">ホーム画面のボタンをカスタマイズ・並び替え</p>
        </div>
      </div>

      <div className="bg-indigo-50/70 rounded-xl p-3 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-indigo-700" data-testid="text-detected-phase">
            自動検出: {phaseDef.name}（{phaseDef.ageLabel}）
          </p>
          {ageMonths !== null && (
            <p className="text-[10px] text-indigo-500 mt-0.5" data-testid="text-child-age">
              {activeChild?.name}は現在{ageMonths}ヶ月です
            </p>
          )}
        </div>
      </div>

      {/* Enabled buttons */}
      <div className="space-y-2 mb-4">
        <p className="text-xs font-bold text-gray-500 mb-2">表示中のボタン</p>
        {enabledActions.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              data-testid={`button-toggle-row-${action.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white/60"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.color.split(" ").slice(0, 2).join(" ")}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700">{action.label}</span>
              <Switch
                checked={true}
                onCheckedChange={() => toggleAction(action.id)}
                data-testid={`switch-toggle-${action.id}`}
              />
            </div>
          );
        })}
      </div>

      {/* Disabled phase buttons — toggle to re-enable */}
      {disabledPhaseActions.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-bold text-gray-400 mb-2">非表示のボタン</p>
          {disabledPhaseActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white/30 opacity-60"
                data-testid={`button-toggle-row-${action.id}`}
              >
                <div className="w-4 h-4 shrink-0" />
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.color.split(" ").slice(0, 2).join(" ")}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-500">{action.label}</span>
                <Switch
                  checked={false}
                  onCheckedChange={() => toggleAction(action.id)}
                  data-testid={`switch-toggle-${action.id}`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add from other phases */}
      {!showOtherPhases ? (
        <Button
          variant="outline"
          onClick={() => setShowOtherPhases(true)}
          className="w-full rounded-xl border-2 border-dashed border-indigo-200 mb-3"
          data-testid="button-show-other-phases"
        >
          <Plus className="w-4 h-4 mr-2" />
          他のフェーズのボタンを追加
        </Button>
      ) : (
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-gray-500">他のフェーズのボタン</p>
            <Button variant="ghost" size="sm" onClick={() => setShowOtherPhases(false)} className="text-xs text-gray-400">
              閉じる
            </Button>
          </div>
          <div className="space-y-2">
            {otherPhaseActions.map((action) => {
              const Icon = action.icon;
              const alreadyAdded = enabledIds.includes(action.id);
              const sourcePhase = phases.find((p) => p.actions.some((a) => a.id === action.id));
              return (
                <div
                  key={action.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 ${alreadyAdded ? "bg-gray-50/50 opacity-60" : "bg-white/40"}`}
                  data-testid={`other-phase-button-${action.id}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.color.split(" ").slice(0, 2).join(" ")}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-700">{action.label}</span>
                    {sourcePhase && <p className="text-[10px] text-gray-400">{sourcePhase.name}</p>}
                  </div>
                  {alreadyAdded ? (
                    <span className="text-[10px] text-gray-400 shrink-0">追加済み</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFromOtherPhase(action.id)}
                      className="shrink-0 rounded-lg"
                      data-testid={`button-add-other-${action.id}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      追加
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        onClick={resetToDefault}
        className="w-full rounded-xl text-xs text-gray-400"
        data-testid="button-reset-buttons"
      >
        デフォルトに戻す
      </Button>
    </section>
  );
}

const SETTINGS_ICON_MAP: Record<string, any> = {
  Star, Heart, HandHeart, Scissors, Brush, Bike, Package, Lamp, Pill, Thermometer,
};

function CustomChildcareSection({ familyId }: { familyId: string }) {
  const { data: items = [] } = useCustomChildcareItems(familyId);
  const deleteItem = useDeleteCustomChildcareItem();
  const { toast } = useToast();

  const handleDelete = (id: number, name: string) => {
    deleteItem.mutate(id, {
      onSuccess: () => {
        toast({
          title: `「${name}」を削除しました`,
          className: "bg-gray-50 border-gray-100 text-gray-900",
        });
      },
    });
  };

  if ((items as any[]).length === 0) return null;

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-purple-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Star className="w-5 h-5 text-purple-500" />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-gray-700" data-testid="text-custom-childcare-title">カスタム育児項目</p>
          <p className="text-[10px] text-gray-400">名もなき育児のカスタム項目を管理</p>
        </div>
      </div>

      <div className="space-y-2">
        {(items as any[]).map((item: any) => {
          const IconComp = SETTINGS_ICON_MAP[item.icon] || Star;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white/60"
              data-testid={`custom-childcare-item-${item.id}`}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <IconComp className="w-4 h-4 text-purple-500" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700">{item.itemName}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(item.id, item.itemName)}
                disabled={deleteItem.isPending}
                data-testid={`button-delete-custom-item-${item.id}`}
              >
                <Trash2 className="w-4 h-4 text-gray-400" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CHILD_COLORS = [
  { label: "ぶどう", value: "#805AAA" },
  { label: "さくら", value: "#E88B9C" },
  { label: "そら", value: "#5B9BD5" },
  { label: "みどり", value: "#6BBF6B" },
  { label: "ひまわり", value: "#F5A623" },
  { label: "うみ", value: "#3BBCB8" },
];

function ChildrenSection({ familyId }: { familyId: string }) {
  const { data: childrenList = [] } = useChildren(familyId);
  const createChild = useCreateChild();
  const deleteChild = useDeleteChild();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBirthday, setNewBirthday] = useState("");
  const [newColor, setNewColor] = useState("#805AAA");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleAdd = () => {
    if (!newName.trim()) return;
    createChild.mutate({
      familyId,
      name: newName.trim(),
      birthday: newBirthday || undefined,
      color: newColor,
    }, {
      onSuccess: async (child: any) => {
        setShowAdd(false);
        setNewName("");
        setNewBirthday("");
        setNewColor("#805AAA");
        setActiveChildIdGlobal(child.id);
        if (child.birthday) {
          localStorage.setItem("activeChildBirthday", child.birthday);
        } else {
          localStorage.removeItem("activeChildBirthday");
        }
        toast({
          title: `${child.name}を追加しました`,
          className: "bg-green-50 border-green-100 text-green-900",
        });
        await queryClient.invalidateQueries({ queryKey: [api.children.list.path] });
        navigate("/child-profile");
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (childrenList.length <= 1) {
      toast({
        title: "最後のお子様は削除できません",
        variant: "destructive",
      });
      return;
    }
    deleteChild.mutate(id, {
      onSuccess: () => {
        const activeId = localStorage.getItem("activeChildId");
        if (activeId && parseInt(activeId) === id) {
          const remaining = childrenList.filter((c: any) => c.id !== id);
          if (remaining.length > 0) {
            setActiveChildIdGlobal(remaining[0].id);
            if (remaining[0].birthday) {
              localStorage.setItem("activeChildBirthday", remaining[0].birthday);
            }
          }
        }
        toast({
          title: `${name}を削除しました`,
          className: "bg-gray-50 border-gray-100 text-gray-900",
        });
      }
    });
  };

  return (
    <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-purple-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-purple-500" />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-gray-700">お子様の管理</p>
          <p className="text-[10px] text-gray-400">きょうだいを追加して切り替えられます</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {childrenList.map((child: any) => {
          const isActive = localStorage.getItem("activeChildId") === String(child.id);
          return (
            <div
              key={child.id}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-colors ${isActive ? "border-purple-200 bg-purple-50/50" : "border-gray-100 bg-gray-50/50"}`}
              data-testid={`child-card-${child.id}`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: child.color + "22", borderColor: child.color, borderWidth: 2 }}
              >
                <Baby className="w-5 h-5" style={{ color: child.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-700 truncate">{child.name}</p>
                {child.birthday && (
                  <p className="text-xs text-gray-400">{child.birthday}</p>
                )}
              </div>
              {isActive && (
                <span className="text-[10px] font-bold text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full shrink-0">選択中</span>
              )}
              <Link href="/child-profile">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full w-8 h-8"
                  onClick={() => {
                    localStorage.setItem("activeChildId", String(child.id));
                    if (child.birthday) localStorage.setItem("activeChildBirthday", child.birthday);
                  }}
                  data-testid={`button-profile-child-${child.id}`}
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Button>
              </Link>
              {childrenList.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full w-8 h-8"
                  onClick={() => handleDelete(child.id, child.name)}
                  data-testid={`button-delete-child-${child.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!showAdd ? (
        <Button
          variant="outline"
          onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border-2 border-dashed border-purple-200"
          data-testid="button-add-child"
        >
          <Plus className="w-4 h-4 mr-2" />
          子どもを追加
        </Button>
      ) : (
        <div className="space-y-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
          <div>
            <Label className="text-xs font-bold text-gray-500 mb-1.5 block">お名前</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例: はなちゃん"
              className="rounded-xl border-2 h-12 text-lg"
              data-testid="input-new-child-name"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-gray-500 mb-1.5 block">生年月日</Label>
            <Input
              type="date"
              value={newBirthday}
              onChange={(e) => setNewBirthday(e.target.value)}
              className="rounded-xl border-2 h-12"
              data-testid="input-new-child-birthday"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" /> イメージカラー
            </Label>
            <div className="flex gap-2 flex-wrap">
              {CHILD_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${newColor === c.value ? "ring-2 ring-offset-2 scale-110" : ""}`}
                  style={{ backgroundColor: c.value + "33", borderColor: c.value, "--tw-ring-color": c.value } as any}
                  onClick={() => setNewColor(c.value)}
                  data-testid={`button-color-${c.value}`}
                  type="button"
                >
                  {newColor === c.value && <Check className="w-4 h-4" style={{ color: c.value }} />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowAdd(false); setNewName(""); setNewBirthday(""); }}
              className="flex-1 rounded-xl"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || createChild.isPending}
              className="flex-1 rounded-xl"
              data-testid="button-confirm-add-child"
            >
              {createChild.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              追加
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Settings() {
  const { userType: globalUserType } = useUserType();
  const [localUserType, setLocalUserType] = useState(globalUserType);
  const { papaLabel, mamaLabel, setPapaLabel, setMamaLabel } = useUserLabels();
  const [editingPapaLabel, setEditingPapaLabel] = useState(papaLabel);
  const [editingMamaLabel, setEditingMamaLabel] = useState(mamaLabel);
  const familyId = localStorage.getItem("familyId") || "default";
  const { data: settings, isLoading } = useSettings(familyId);
  const { data: childrenList = [] } = useChildren(familyId);
  const { mutate, isPending } = useUpdateSettings();
  const { updateRole } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const activeChildId = localStorage.getItem("activeChildId");
  const activeChild = childrenList.find((c: any) => String(c.id) === activeChildId) || childrenList[0] || null;
  
  const isFirstSetup = settings?.babyName === "赤ちゃんのなまえ";
  
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      familyId: familyId,
      babyName: "",
      currentCaregiver: "パパ",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        familyId: settings.familyId,
        babyName: isFirstSetup ? "" : settings.babyName,
        babyBirthday: settings.babyBirthday || "",
        specialTrick: settings.specialTrick || "ビニール袋の音",
        currentCaregiver: settings.currentCaregiver,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsForm) => {
    localStorage.setItem("familyId", data.familyId);
    setUserTypeGlobal(localUserType);
    try {
      updateRole(localUserType);
    } catch {}
    mutate(data, {
      onSettled: () => {
        toast({
          title: "設定を保存しました",
          className: "bg-green-50 border-green-100 text-green-900",
        });
        setTimeout(() => navigate("/"), 300);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-green-50/50 pb-24 font-sans">
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50" data-testid="button-back-home">
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </Button>
          </Link>
          <h1 className="text-2xl font-black text-gray-800">
            {isFirstSetup ? "はじめまして！" : "アプリ設定"}
          </h1>
        </div>

        {isFirstSetup && (
          <div className="bg-purple-50 rounded-[24px] p-5 mb-6 border border-purple-100">
            <p className="text-sm text-purple-700 font-medium leading-relaxed">
              ようこそ、ぶどうの木へ。まずはお子様のお名前とお誕生日をお聞かせくださいませ。このアプリの大切な主役でございます。
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-settings">
              <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-purple-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Baby className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-700">赤ちゃんのプロフィール</p>
                    <p className="text-[10px] text-gray-400">アプリの主役を登録しましょう</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="babyName" className="text-sm font-bold text-gray-600 mb-1.5 block">
                      お名前
                    </Label>
                    <Input
                      id="babyName"
                      {...form.register("babyName")}
                      className="rounded-xl border-2 border-gray-100 h-12 text-lg"
                      placeholder="例: はなちゃん、りくくん"
                      data-testid="input-baby-name"
                    />
                    {form.formState.errors.babyName && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.babyName.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="babyBirthday" className="text-sm font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <Cake className="w-4 h-4 text-purple-400" />
                      <span>生年月日</span>
                    </Label>
                    <Input
                      id="babyBirthday"
                      type="date"
                      {...form.register("babyBirthday")}
                      className="rounded-xl border-2 border-gray-100 h-12 text-lg"
                      data-testid="input-baby-birthday"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">生後4ヶ月でAIキャラが切り替わります</p>
                  </div>
                </div>
              </section>

              <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border border-purple-50">
                <Label className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> あなたの役割
                </Label>
                <RadioGroup
                  value={localUserType}
                  onValueChange={(val) => {
                    setLocalUserType(val);
                    setUserTypeGlobal(val);
                  }}
                  className="grid grid-cols-3 gap-3"
                  data-testid="radio-user-type"
                >
                  {[
                    { id: "papa", label: papaLabel, IconComponent: User },
                    { id: "mama", label: mamaLabel, IconComponent: Crown },
                    { id: "other", label: "その他", IconComponent: Users }
                  ].map((u) => (
                    <div key={u.id}>
                      <RadioGroupItem value={u.id} id={u.id} className="peer sr-only" />
                      <Label
                        htmlFor={u.id}
                        className="flex flex-col items-center justify-center py-4 rounded-xl border-2 cursor-pointer bg-white peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-purple-50 peer-data-[state=checked]:text-primary"
                        data-testid={`label-role-${u.id}`}
                      >
                        <u.IconComponent className="w-6 h-6 mb-1" />
                        <span className="font-bold text-sm">{u.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </section>

              {/* 呼び方の変更 */}
              <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border border-purple-50">
                <Label className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> 呼び方の変更
                </Label>
                <p className="text-xs text-gray-400 mb-4">「パパ」「ママ」の代わりに使う名前を設定できます。空欄の場合はデフォルトに戻ります。</p>
                <div className="space-y-3">
                  {[
                    { key: "papa" as const, label: "パパ側", value: editingPapaLabel, setter: setEditingPapaLabel, save: setPapaLabel, color: "border-blue-200 focus:border-blue-400" },
                    { key: "mama" as const, label: "ママ側", value: editingMamaLabel, setter: setEditingMamaLabel, save: setMamaLabel, color: "border-pink-200 focus:border-pink-400" },
                  ].map(({ key, label, value, setter, save, color }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 w-14 shrink-0">{label}</span>
                      <Input
                        data-testid={`input-label-${key}`}
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        onBlur={() => save(value)}
                        placeholder={key === "papa" ? "パパ" : "ママ"}
                        maxLength={6}
                        className={`flex-1 h-10 rounded-xl border-2 ${color} text-sm font-bold`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border border-purple-50">
                <Label htmlFor="specialTrick" className="text-base font-bold text-gray-700 mb-2 block">
                  わが家の必殺技
                </Label>
                <Input
                  id="specialTrick"
                  {...form.register("specialTrick")}
                  className="rounded-xl border-2 border-gray-100 h-12 text-lg"
                  placeholder="例: ビニール袋の音"
                  data-testid="input-special-trick"
                />
                <p className="text-xs text-gray-500 mt-2">レスキューのステップに組み込まれます</p>
              </section>

              <Button type="submit" disabled={isPending} className="w-full h-14 rounded-2xl text-lg font-bold" data-testid="button-save-settings">
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                {isFirstSetup ? "登録してはじめる" : "設定を保存"}
              </Button>
            </form>

            <ChildrenSection familyId={familyId} />

            <CustomChildcareSection familyId={familyId} />

            <PairingSection familyId={familyId} />

            <ThemeSection />

            <FeatureToggleSection />

            <FeedingNotificationSection />

            <FeedbackSection />

            <Link href="/tips">
              <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm p-4 rounded-[24px] shadow-sm border border-gray-100 cursor-pointer" data-testid="link-tips">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700">使い方ヒント</p>
                    <p className="text-[10px] text-gray-400">パートナー招待・ご褒美ショップなど</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>

            <Link href="/legal">
              <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm p-4 rounded-[24px] shadow-sm border border-gray-100 cursor-pointer" data-testid="link-legal">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Info className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700">プライバシーポリシー・利用規約</p>
                    <p className="text-[10px] text-gray-400">個人情報の取り扱いについて</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>

            {localStorage.getItem("lineDisplayName") && (
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                    window.location.href = "/";
                  });
                }}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-[24px] border border-red-200 bg-red-50 text-red-600 font-bold text-sm"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            )}

            <div className="text-center pt-4 pb-8">
              <p className="text-[10px] text-gray-300 font-bold">We育 Beta v1.0</p>
              <p className="text-[10px] text-gray-300">by 産前産後ケアホテル ぶどうの木</p>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
