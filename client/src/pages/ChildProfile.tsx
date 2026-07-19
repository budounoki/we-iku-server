import { useState, useEffect, useMemo, useCallback } from "react";
import { useUserLabels } from "@/hooks/use-user-labels";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import {
  ArrowLeft, Baby, Footprints, GraduationCap, Save, Loader2,
  ChevronUp, ChevronDown, Eye, EyeOff, Sparkles, Users, Copy, Check,
  Star, Moon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useChildren, useUpdateChild, useLogs, useSkillCompletions } from "@/hooks/use-app-data";
import { useActiveChild } from "@/hooks/use-active-child";
import { useToast } from "@/hooks/use-toast";
import { phases, getPhaseForAge, PhaseActionConfig } from "@/lib/phases";
import { TEAM_SKILL_LEVELS, getSkillIcon } from "@/pages/SkillTree";
import { BottomNav } from "@/components/Navigation";

const CHILD_COLORS = [
  { label: "ぶどう", value: "#805AAA" },
  { label: "さくら", value: "#E88B9C" },
  { label: "そら", value: "#5B9BD5" },
  { label: "みどり", value: "#6BBF6B" },
  { label: "ひまわり", value: "#F5A623" },
  { label: "うみ", value: "#3BBCB8" },
];

const GENDER_OPTIONS = [
  { label: "男の子", value: "male" },
  { label: "女の子", value: "female" },
  { label: "未設定", value: "" },
];

interface ModeConfig {
  id: string;
  label: string;
  icon: typeof Baby;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
  ageRange: string;
  phaseIds: number[];
}

const MODES: ModeConfig[] = [
  {
    id: "infant",
    label: "乳児モード",
    icon: Baby,
    colorClass: "text-indigo-600",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-300",
    description: "授乳・おむつ・睡眠中心",
    ageRange: "0-1歳",
    phaseIds: [0],
  },
  {
    id: "toddler",
    label: "幼児モード",
    icon: Footprints,
    colorClass: "text-orange-600",
    bgClass: "bg-orange-50",
    borderClass: "border-orange-300",
    description: "トイトレ・食事・イヤイヤ期・ことば中心",
    ageRange: "1-3歳",
    phaseIds: [1, 2],
  },
  {
    id: "kids",
    label: "キッズモード",
    icon: GraduationCap,
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-300",
    description: "予定管理・できたねスタンプ・入学準備中心",
    ageRange: "4-6歳",
    phaseIds: [3],
  },
];

function getAgeDisplay(birthday: string | null | undefined): { text: string; months: number } | null {
  if (!birthday) return null;
  const birth = parseISO(birthday);
  const now = new Date();
  const totalMonths = differenceInMonths(now, birth);
  const years = differenceInYears(now, birth);

  if (totalMonths < 0) return null;

  if (totalMonths < 12) {
    return { text: `生後${totalMonths}ヶ月`, months: totalMonths };
  }

  const remainingMonths = totalMonths - years * 12;
  if (remainingMonths === 0) {
    return { text: `${years}歳`, months: totalMonths };
  }
  return { text: `${years}歳${remainingMonths}ヶ月`, months: totalMonths };
}

function getSuggestedMode(ageMonths: number | null): string {
  if (ageMonths === null) return "infant";
  if (ageMonths < 12) return "infant";
  if (ageMonths < 48) return "toddler";
  return "kids";
}

function getActionsForMode(mode: ModeConfig): PhaseActionConfig[] {
  const seen = new Set<string>();
  const actions: PhaseActionConfig[] = [];
  for (const phaseId of mode.phaseIds) {
    const phase = phases.find((p) => p.id === phaseId);
    if (phase) {
      for (const action of phase.actions) {
        if (!seen.has(action.id)) {
          seen.add(action.id);
          actions.push(action);
        }
      }
    }
  }
  return actions;
}

function SparkleEffect() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 2, delay: 0.5 }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{
            x: `${30 + Math.random() * 40}%`,
            y: `${30 + Math.random() * 40}%`,
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: `${Math.random() * 100}%`,
            y: `${Math.random() * 100}%`,
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5 + Math.random(),
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
        >
          <Sparkles className="w-5 h-5 text-yellow-400" />
        </motion.div>
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute"
          initial={{
            x: `${20 + Math.random() * 60}%`,
            y: `${20 + Math.random() * 60}%`,
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: `${Math.random() * 100}%`,
            y: `${Math.random() * 100}%`,
            scale: [0, 1.2, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.2 + Math.random(),
            delay: 0.2 + Math.random() * 0.4,
            ease: "easeOut",
          }}
        >
          <Star className="w-4 h-4 text-purple-400" />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default function ChildProfile() {
  const [, navigate] = useLocation();
  const familyId = localStorage.getItem("familyId") || "default";
  const userType = localStorage.getItem("userType") || "papa";
  const { papaLabel, mamaLabel } = useUserLabels();
  const { activeChild, children: childrenList } = useActiveChild(familyId);
  const updateChild = useUpdateChild();
  const { data: allLogs = [] } = useLogs(familyId);
  const { data: skillCompletions = [] } = useSkillCompletions(familyId);
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [color, setColor] = useState("#805AAA");
  const [selectedMode, setSelectedMode] = useState("infant");
  const [enabledActions, setEnabledActions] = useState<string[]>([]);
  const [showSparkle, setShowSparkle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sleepTrainingEnabled, setSleepTrainingEnabled] = useState(true);

  useEffect(() => {
    if (activeChild) {
      setName(activeChild.name || "");
      setBirthday(activeChild.birthday || "");
      setGender(activeChild.gender || "");
      setColor(activeChild.color || "#805AAA");
      setSleepTrainingEnabled(activeChild.sleepTrainingEnabled !== false);

      const ageInfo = getAgeDisplay(activeChild.birthday);
      const suggested = getSuggestedMode(ageInfo?.months ?? null);
      setSelectedMode(suggested);
    }
  }, [activeChild?.id]);

  const ageInfo = useMemo(() => getAgeDisplay(birthday), [birthday]);
  const suggestedMode = useMemo(() => getSuggestedMode(ageInfo?.months ?? null), [ageInfo]);

  const currentMode = useMemo(() => MODES.find((m) => m.id === selectedMode) || MODES[0], [selectedMode]);
  const modeActions = useMemo(() => getActionsForMode(currentMode), [currentMode]);

  useEffect(() => {
    if (!activeChild) return;
    const storageKey = `phase_button_overrides_${activeChild.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setEnabledActions(JSON.parse(stored));
        return;
      } catch { /* ignore */ }
    }
    setEnabledActions(modeActions.map((a) => a.id));
  }, [activeChild?.id, selectedMode]);

  const toggleAction = useCallback((actionId: string) => {
    setEnabledActions((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  }, []);

  const moveAction = useCallback((index: number, direction: "up" | "down") => {
    setEnabledActions((prev) => {
      const newArr = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev;
      [newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]];
      return newArr;
    });
  }, []);

  const handleSave = async () => {
    if (!activeChild) return;
    setSaving(true);

    try {
      await updateChild.mutateAsync({
        id: activeChild.id,
        name: name.trim() || activeChild.name,
        birthday: birthday || undefined,
        gender: gender || undefined,
        color,
        sleepTrainingEnabled,
      });

      const storageKey = `phase_button_overrides_${activeChild.id}`;
      localStorage.setItem(storageKey, JSON.stringify(enabledActions));

      setShowSparkle(true);
      setTimeout(() => setShowSparkle(false), 2500);

      toast({
        title: `${name || activeChild.name}ちゃんの成長に合わせて、ホーム画面をアップデートしました！`,
        className: "bg-purple-50 border-purple-100 text-purple-900",
      });
    } catch {
      toast({
        title: "保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(familyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const completedSkillIds = useMemo(() => {
    return new Set((skillCompletions as any[]).map((c: any) => c.skillId));
  }, [skillCompletions]);

  const completedTeamSkills = useMemo(() => {
    return TEAM_SKILL_LEVELS.flatMap((level) =>
      level.skills.filter((s) => completedSkillIds.has(s.id))
    );
  }, [completedSkillIds]);

  const papaLogs = useMemo(() => {
    const filtered = (allLogs as any[]).filter((l: any) => l.userId === "papa");
    return filtered.length > 0 ? filtered[0] : null;
  }, [allLogs]);

  const mamaLogs = useMemo(() => {
    const filtered = (allLogs as any[]).filter((l: any) => l.userId === "mama");
    return filtered.length > 0 ? filtered[0] : null;
  }, [allLogs]);

  if (!activeChild) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50 pb-24">
      <AnimatePresence>
        {showSparkle && <SparkleEffect />}
      </AnimatePresence>

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back-to-settings">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-black text-gray-800" data-testid="text-page-title">プロフィール設定</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-purple-200"
        >
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-3 shadow-sm"
              style={{ backgroundColor: color + "30", borderColor: color, borderWidth: 3 }}
              data-testid="avatar-child"
            >
              <Baby className="w-10 h-10" style={{ color }} />
            </div>
            <h2 className="text-xl font-black text-gray-800" data-testid="text-child-name-display">
              {name || activeChild.name}
            </h2>
            {ageInfo && (
              <p className="text-2xl font-black mt-1" style={{ color }} data-testid="text-child-age">
                {ageInfo.text}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">なまえ</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="お子さまの名前"
                className="rounded-xl border-2"
                data-testid="input-child-name"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">たんじょうび</Label>
              <Input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="rounded-xl border-2"
                data-testid="input-child-birthday"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">せいべつ</Label>
              <div className="flex gap-2 flex-wrap">
                {GENDER_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={gender === opt.value ? "default" : "outline"}
                    onClick={() => setGender(opt.value)}
                    className="rounded-xl flex-1"
                    data-testid={`button-gender-${opt.value || "unset"}`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">イメージカラー</Label>
              <div className="flex gap-2 flex-wrap">
                {CHILD_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={`w-10 h-10 rounded-full border-2 transition-transform ${
                      color === c.value ? "ring-2 ring-offset-2 scale-110" : ""
                    }`}
                    style={{
                      backgroundColor: c.value,
                      borderColor: color === c.value ? c.value : "transparent",
                    }}
                    title={c.label}
                    data-testid={`button-color-${c.label}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-blue-200"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-700" data-testid="text-mode-section-title">育児モード・セレクト</p>
              <p className="text-[10px] text-gray-400">お子さまの成長に合わせたモード</p>
            </div>
          </div>

          <div className="space-y-3">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              const isSuggested = suggestedMode === mode.id;

              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`w-full text-left p-4 rounded-[20px] border-2 transition-all ${
                    isSelected
                      ? `${mode.bgClass} ${mode.borderClass} shadow-sm`
                      : "bg-white/60 border-gray-100"
                  }`}
                  data-testid={`button-mode-${mode.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${mode.bgClass} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-6 h-6 ${mode.colorClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold ${isSelected ? mode.colorClass : "text-gray-700"}`}>
                          {mode.label}
                        </span>
                        {isSuggested && (
                          <Badge variant="secondary" className="text-[10px]" data-testid={`badge-suggested-${mode.id}`}>
                            おすすめ
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{mode.ageRange}</p>
                      <p className="text-xs text-gray-400 mt-1">{mode.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white/80 backdrop-blur-sm p-5 rounded-[24px] shadow-sm border-2 border-indigo-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Moon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-700" data-testid="text-sleep-training-title">ネントレモード</p>
                <p className="text-[10px] text-gray-400">睡眠トレーニング機能を使う</p>
              </div>
            </div>
            <Switch
              checked={sleepTrainingEnabled}
              onCheckedChange={setSleepTrainingEnabled}
              data-testid="switch-sleep-training"
            />
          </div>
          {sleepTrainingEnabled && (
            <p className="text-xs text-indigo-500 mt-3 ml-[52px]">
              ねんねボタンに「ネントレタイマーで計測する」が表示されます
            </p>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-indigo-200"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-700" data-testid="text-button-customize-title">ボタンカスタマイズ</p>
              <p className="text-[10px] text-gray-400">表示・並び順を変更</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {modeActions.map((action, index) => {
              const Icon = action.icon;
              const isEnabled = enabledActions.includes(action.id);
              const enabledIndex = enabledActions.indexOf(action.id);

              return (
                <div
                  key={action.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isEnabled ? "border-gray-200 bg-white/80" : "border-gray-100 bg-gray-50/50 opacity-60"
                  }`}
                  data-testid={`button-customize-row-${action.id}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.color.split(" ").slice(0, 2).join(" ")}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700">{action.label}</span>

                  {isEnabled && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveAction(enabledIndex, "up")}
                        disabled={enabledIndex <= 0}
                        className="shrink-0"
                        data-testid={`button-move-up-${action.id}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveAction(enabledIndex, "down")}
                        disabled={enabledIndex >= enabledActions.length - 1}
                        className="shrink-0"
                        data-testid={`button-move-down-${action.id}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleAction(action.id)}
                    data-testid={`switch-action-${action.id}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 mb-3">ホーム画面プレビュー</p>
            <div className="flex flex-wrap gap-2">
              {enabledActions.map((actionId) => {
                const action = modeActions.find((a) => a.id === actionId);
                if (!action) return null;
                const Icon = action.icon;
                return (
                  <div
                    key={actionId}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium ${action.color}`}
                    data-testid={`preview-button-${actionId}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {action.label}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm p-6 rounded-[24px] shadow-sm border-2 border-green-200"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-700" data-testid="text-partner-section-title">We育ステータス</p>
              <p className="text-[10px] text-gray-400">パートナーとの共有状況</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">ペアリングコード</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-mono text-base font-black text-purple-600 tracking-wider" data-testid="text-pairing-code">
                  {familyId}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  className="rounded-xl border-2 shrink-0"
                  data-testid="button-copy-code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-[10px] font-bold text-blue-500 mb-1">{papaLabel}の最新記録</p>
                {papaLogs ? (
                  <p className="text-xs text-gray-600" data-testid="text-papa-last-log">
                    {papaLogs.type} - {new Date(papaLogs.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400" data-testid="text-papa-no-log">まだ記録なし</p>
                )}
              </div>
              <div className="bg-pink-50 rounded-xl p-3 border border-pink-100">
                <p className="text-[10px] font-bold text-pink-500 mb-1">{mamaLabel}の最新記録</p>
                {mamaLogs ? (
                  <p className="text-xs text-gray-600" data-testid="text-mama-last-log">
                    {mamaLogs.type} - {new Date(mamaLogs.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400" data-testid="text-mama-no-log">まだ記録なし</p>
                )}
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 mb-1">現在の担当</p>
              <p className="text-sm font-bold text-purple-700" data-testid="text-current-caregiver">
                {userType === "papa" ? papaLabel : mamaLabel} が操作中
              </p>
            </div>
          </div>
        </motion.section>

        {completedTeamSkills.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="bg-white/80 backdrop-blur-sm p-5 rounded-[24px] shadow-sm border border-purple-100"
          >
            <p className="text-xs font-bold text-purple-500 mb-3" data-testid="text-skill-badges-title">
              習得したチーム育児スキル
            </p>
            <div className="flex flex-wrap gap-2">
              {completedTeamSkills.map((skill) => {
                const SkillIcon = getSkillIcon(skill.id);
                return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100"
                    data-testid={`badge-profile-skill-${skill.id}`}
                  >
                    <SkillIcon className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[11px] font-bold text-purple-700">{skill.title}</span>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-[20px] font-bold text-base py-6 bg-gradient-to-r from-purple-500 to-indigo-500"
            data-testid="button-save-profile"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            保存する
          </Button>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
