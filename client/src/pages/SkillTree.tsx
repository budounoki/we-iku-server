import { BottomNav } from "@/components/Navigation";
import { useSkillCompletions, useCompleteSkill, useUncompleteSkill } from "@/hooks/use-app-data";
import { useActiveChild } from "@/hooks/use-active-child";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Users, Handshake, Brain, CalendarClock,
  ChevronDown, ChevronUp, Award, X, Sparkles, Zap,
  Utensils, Droplets, MessageCircle, RefreshCw,
  ClipboardList, HandHeart, Baby, Moon, ShieldCheck,
  Bath, Package, Heart, Trees, ThumbsUp, Stethoscope,
  Scale, Coins, Compass, Home, Trophy, Lock
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { differenceInMonths, parseISO } from "date-fns";

interface TeamSkillDef {
  id: string;
  title: string;
  condition: string;
  mioMessage: string;
}

interface SkillLevelDef {
  id: string;
  level: number;
  title: string;
  subtitle: string;
  ageRange: string;
  minMonths: number;
  maxMonths: number;
  icon: typeof Users;
  color: string;
  bgColor: string;
  borderColor: string;
  skills: TeamSkillDef[];
}

const TEAM_SKILL_LEVELS: SkillLevelDef[] = [
  {
    id: "level0",
    level: 0,
    title: "はじめての共同オペスキル",
    subtitle: "ふたりで赤ちゃんを迎える基礎力",
    ageRange: "0〜1歳",
    minMonths: 0,
    maxMonths: 11,
    icon: Baby,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
    skills: [
      {
        id: "fast_diaper",
        title: "爆速おむつ替え",
        condition: "横漏れ・背中漏れさせずに、二人で連携してスムーズに完了できた",
        mioMessage: "息ぴったりのおむつ替え、赤ちゃんもご機嫌ですね。",
      },
      {
        id: "burp_master",
        title: "ゲップの魔術師",
        condition: "授乳後のゲップ出しを、二人で交代しながらスムーズにできた",
        mioMessage: "赤ちゃんもスッキリしましたね。魔法の手ですね。",
      },
      {
        id: "solo_bath",
        title: "沐浴・バスタイム連携",
        condition: "お風呂の準備から洗い、保湿、着替えまで二人で分担して完遂できた",
        mioMessage: "お風呂タイムの連携プレー、お見事です。赤ちゃんもぽかぽかですね。",
      },
      {
        id: "cry_stopper",
        title: "ギャン泣き鎮火リレー",
        condition: "泣き止まない赤ちゃんを、交代（バトンタッチ）しながら落ち着かせた",
        mioMessage: "バトンタッチで乗り越えるのが、チーム育児の真骨頂ですね。",
      },
      {
        id: "night_shift",
        title: "深夜シフトの交代制",
        condition: "夜間の授乳・おむつ替えを、交代制で回して睡眠を確保できた",
        mioMessage: "お互いの睡眠を守る。それが長く続ける秘訣ですね。",
      },
      {
        id: "perfect_packing",
        title: "忘れ物ゼロ・パッキング",
        condition: "おむつ・着替え・ミルクセット等、外出準備を二人で完璧にできた",
        mioMessage: "完璧な準備力。お出かけの安心感が違いますね。",
      },
      {
        id: "invisible_backup",
        title: "見えないバックアップ",
        condition: "言われる前に哺乳瓶洗い・ゴミ出し・洗濯等のサポートを完了した",
        mioMessage: "気づいて動ける。最高のチームプレーですね。",
      },
      {
        id: "doctor_report",
        title: "ドクター報告マスター",
        condition: "病院で体温・便の状態・症状をログを見せながら正確に報告できた",
        mioMessage: "記録の力が、お子さまの健康を守りましたね。素晴らしい連携です。",
      },
    ],
  },
  {
    id: "level1",
    level: 1,
    title: "生活自立の伴走スキル",
    subtitle: "ふたりで基本の生活をサポート",
    ageRange: "1〜2歳",
    minMonths: 12,
    maxMonths: 35,
    icon: Handshake,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    skills: [
      {
        id: "toilet_navigate",
        title: "トイトレ・ナビゲート",
        condition: "子供のサインを見逃さず、二人で連携してトイレに誘導できた",
        mioMessage: "お二人の息がぴったりですね。お子さまも安心してチャレンジできましたね。",
      },
      {
        id: "meal_produce",
        title: "食事のプロデュース",
        condition: "好き嫌いや遊び食べに対し、二人で一貫した態度で楽しく食事を完結させた",
        mioMessage: "食卓の空気を二人で整えられるのは、素晴らしいチームワークですね。",
      },
      {
        id: "outing_relay",
        title: "公園・お出かけリレー",
        condition: "走り回る子を二人で交代しながら見守り、安全に外遊びを終えられた",
        mioMessage: "目線を切らさないリレー、お見事です。お子さまも思い切り遊べましたね。",
      },
      {
        id: "sleep_routine",
        title: "ねんねルーティン構築",
        condition: "お風呂→歯みがき→絵本→ねんねの流れを二人で一貫して回せた",
        mioMessage: "毎日の小さな積み重ねが、ぐっすり眠る力に育ちますね。",
      },
      {
        id: "sick_team",
        title: "病気のときのチーム対応",
        condition: "発熱や体調不良時に役割分担（看病・受診・連絡）して乗り切った",
        mioMessage: "片方が崩れない仕組みづくりが、家族を守る一番の力ですね。",
      },
    ],
  },
  {
    id: "level2",
    level: 2,
    title: "メンタル・コーチングスキル",
    subtitle: "子供の心に寄り添う連携力",
    ageRange: "2〜4歳",
    minMonths: 24,
    maxMonths: 59,
    icon: Brain,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    skills: [
      {
        id: "tantrum_handling",
        title: "イヤイヤ期・ハンドリング",
        condition: "爆発した子供の感情を、二人で交代（バトンタッチ）しながら冷静に鎮められた",
        mioMessage: "バトンタッチで乗り越える。それが『チーム育児』の真価ですね。",
      },
      {
        id: "word_empathy",
        title: "言葉の共感ビルド",
        condition: "子供の拙い言葉を二人が同じ解釈で受け止め、語彙を広げてあげられた",
        mioMessage: "お二人が同じ目線で言葉を受け止める。お子さまの言葉がぐんと伸びますね。",
      },
      {
        id: "rule_consistency",
        title: "ルール・統一戦線",
        condition: "おやつ・テレビ・寝る時間など、二人で同じルールを守って伝えられた",
        mioMessage: "ふたりの軸が揃うと、子どもは安心してルールを学べますね。",
      },
      {
        id: "praise_relay",
        title: "ほめ言葉のリレー",
        condition: "片方が見つけた『できた！』を、もう片方にも共有して二重に褒められた",
        mioMessage: "二度褒められる嬉しさは、自己肯定感の最高の栄養ですね。",
      },
      {
        id: "social_support",
        title: "お友達トラブル・サポート",
        condition: "園や公園での子供同士のトラブルを、二人で同じ方針で受け止められた",
        mioMessage: "ふたりで方針を決めて関わる姿勢、お子さまにとって何よりの安心です。",
      },
    ],
  },
  {
    id: "level3",
    level: 3,
    title: "チーム・マネジメントスキル",
    subtitle: "家族の運営を二人で完璧に",
    ageRange: "4〜6歳",
    minMonths: 48,
    maxMonths: 72,
    icon: CalendarClock,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    skills: [
      {
        id: "schedule_sync",
        title: "スケジュール・同期",
        condition: "園の行事や習い事を、どちらかが不在でも完璧に回せる情報共有ができた",
        mioMessage: "情報の共有力は、チームの信頼そのもの。素晴らしい連携です。",
      },
      {
        id: "independence_support",
        title: "自立支援・スタンプ",
        condition: "子供の『自分でやりたい』を引き出し、先回りせずに見守れた",
        mioMessage: "見守る勇気こそ、親の最高のスキルですね。お子さまの自信が育っています。",
      },
      {
        id: "money_lesson",
        title: "おこづかい・お金の学び",
        condition: "おこづかいやお買い物体験を通じて、二人で『お金の使い方』を伝えられた",
        mioMessage: "お金との付き合い方は、生きる力の土台ですね。素敵な学びをありがとう。",
      },
      {
        id: "future_dialogue",
        title: "未来の対話・進路相談",
        condition: "小学校・習い事・将来の話を二人でフラットに話し合えた",
        mioMessage: "ふたりで未来を描く時間こそ、家族の財産ですね。",
      },
      {
        id: "family_council",
        title: "家族会議・運営術",
        condition: "週末や月初に家族で予定・気持ちを共有する時間を持てた",
        mioMessage: "話し合える家族は、どんなことも乗り越えられますね。",
      },
    ],
  },
];

const TEAM_TITLES: { min: number; title: string; emoji: string }[] = [
  { min: 0, title: "新米チーム", emoji: "🌱" },
  { min: 3, title: "ビギナーチーム", emoji: "🌿" },
  { min: 7, title: "中堅チーム", emoji: "🌳" },
  { min: 12, title: "達人チーム", emoji: "✨" },
  { min: 18, title: "マスターチーム", emoji: "👑" },
  { min: 24, title: "レジェンドチーム", emoji: "🏆" },
];

function getTeamTitle(completed: number) {
  let current = TEAM_TITLES[0];
  for (const t of TEAM_TITLES) {
    if (completed >= t.min) current = t;
  }
  const next = TEAM_TITLES.find((t) => t.min > completed);
  return { current, next };
}

function getSkillIcon(skillId: string) {
  const iconMap: Record<string, typeof Users> = {
    fast_diaper: Zap,
    burp_master: Heart,
    solo_bath: Bath,
    cry_stopper: ShieldCheck,
    night_shift: Moon,
    perfect_packing: Package,
    invisible_backup: Sparkles,
    doctor_report: ClipboardList,
    toilet_navigate: Droplets,
    meal_produce: Utensils,
    tantrum_handling: RefreshCw,
    word_empathy: MessageCircle,
    schedule_sync: CalendarClock,
    independence_support: HandHeart,
    outing_relay: Trees,
    sleep_routine: Moon,
    sick_team: Stethoscope,
    rule_consistency: Scale,
    praise_relay: ThumbsUp,
    social_support: Users,
    money_lesson: Coins,
    future_dialogue: Compass,
    family_council: Home,
  };
  return iconMap[skillId] || Award;
}

function getRelevantLevels(ageMonths: number | null): SkillLevelDef[] {
  if (ageMonths === null) return TEAM_SKILL_LEVELS;
  return TEAM_SKILL_LEVELS.filter(
    (l) => ageMonths >= l.minMonths && ageMonths <= l.maxMonths
  );
}

export { TEAM_SKILL_LEVELS, getSkillIcon };
export type { TeamSkillDef, SkillLevelDef };

export default function SkillTree() {
  const familyId = localStorage.getItem("familyId") || "default";
  const userId = localStorage.getItem("userType") || "papa";
  const { activeChild } = useActiveChild(familyId);
  const { data: completions = [] } = useSkillCompletions(familyId);
  const completeSkill = useCompleteSkill();
  const uncompleteSkill = useUncompleteSkill();
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [celebrationSkill, setCelebrationSkill] = useState<TeamSkillDef | null>(null);

  const ageMonths = useMemo(() => {
    if (!activeChild?.birthday) return null;
    return differenceInMonths(new Date(), parseISO(activeChild.birthday));
  }, [activeChild?.birthday]);

  const relevantLevels = useMemo(() => getRelevantLevels(ageMonths), [ageMonths]);
  const allLevels = TEAM_SKILL_LEVELS;

  useEffect(() => {
    if (relevantLevels.length > 0) {
      setExpandedLevel(relevantLevels[0].id);
    } else {
      setExpandedLevel(allLevels[0].id);
    }
  }, [ageMonths]);

  const completedSkillIds = useMemo(() => {
    return new Set((completions as any[]).map((c: any) => c.skillId));
  }, [completions]);

  const totalCompleted = useMemo(() => {
    let count = 0;
    for (const level of TEAM_SKILL_LEVELS) {
      for (const skill of level.skills) {
        if (completedSkillIds.has(skill.id)) count++;
      }
    }
    return count;
  }, [completedSkillIds]);

  const totalSkills = TEAM_SKILL_LEVELS.reduce((sum, l) => sum + l.skills.length, 0);
  const teamTitle = useMemo(() => getTeamTitle(totalCompleted), [totalCompleted]);

  const handleToggleSkill = (skill: TeamSkillDef) => {
    if (completedSkillIds.has(skill.id)) {
      uncompleteSkill.mutate({ familyId, userId, skillId: skill.id });
    } else {
      completeSkill.mutate({ familyId, userId, skillId: skill.id });
      setCelebrationSkill(skill);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-green-50 pb-32">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-black text-gray-800" data-testid="text-page-title">
              チーム育児スキル
            </h1>
            <p className="text-[10px] text-gray-400">二人の経験値の蓄積</p>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-5">
        <Card className="p-5 rounded-3xl border-purple-100 bg-gradient-to-br from-purple-50 to-white" data-testid="card-team-summary">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-200 to-green-100 flex items-center justify-center">
              <Users className="w-7 h-7 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Trophy className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-black text-purple-800" data-testid="text-team-title">
                  {teamTitle.current.title}
                </p>
              </div>
              <p className="text-xs text-purple-500 mt-1">
                {totalCompleted}/{totalSkills} スキル習得済み
              </p>
              <div className="h-2 bg-purple-100 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${totalSkills > 0 ? (totalCompleted / totalSkills) * 100 : 0}%` }}
                  data-testid="progress-team-skills"
                />
              </div>
              {teamTitle.next && (
                <p className="text-[10px] text-purple-400 mt-1.5">
                  次の称号「{teamTitle.next.title}」まで あと {teamTitle.next.min - totalCompleted} スキル
                </p>
              )}
            </div>
          </div>

          {totalCompleted > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {TEAM_SKILL_LEVELS.flatMap((level) =>
                level.skills
                  .filter((s) => completedSkillIds.has(s.id))
                  .map((skill) => {
                    const SkillIcon = getSkillIcon(skill.id);
                    return (
                      <Badge
                        key={skill.id}
                        variant="secondary"
                        className="text-[10px] gap-1 py-0.5 px-2"
                        data-testid={`badge-skill-${skill.id}`}
                      >
                        <SkillIcon className="w-3 h-3" />
                        {skill.title}
                      </Badge>
                    );
                  })
              )}
            </div>
          )}
        </Card>

        {allLevels.map((level) => {
          const isExpanded = expandedLevel === level.id;
          const levelCompleted = level.skills.filter((s) => completedSkillIds.has(s.id)).length;
          const LevelIcon = level.icon;
          const isCurrentLevel = ageMonths !== null && ageMonths >= level.minMonths && ageMonths <= level.maxMonths;
          const isFuture = ageMonths !== null && ageMonths < level.minMonths;
          const isPast = ageMonths !== null && ageMonths > level.maxMonths;

          return (
            <Card
              key={level.id}
              className={cn(
                "rounded-3xl overflow-visible",
                isCurrentLevel ? level.borderColor : "border-gray-100",
                isFuture && "opacity-70"
              )}
              data-testid={`card-level-${level.id}`}
            >
              <button
                onClick={() => setExpandedLevel(isExpanded ? null : level.id)}
                className="w-full p-4 flex items-center gap-3 text-left"
                data-testid={`button-toggle-${level.id}`}
              >
                <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", level.bgColor)}>
                  <LevelIcon className={cn("w-5 h-5", level.color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">Lv.{level.level + 1} {level.title}</span>
                    {isCurrentLevel && (
                      <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700" data-testid={`badge-current-${level.id}`}>
                        いまここ
                      </Badge>
                    )}
                    {isFuture && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5 bg-gray-100 text-gray-500" data-testid={`badge-future-${level.id}`}>
                        <Lock className="w-2.5 h-2.5" />これから
                      </Badge>
                    )}
                    {isPast && levelCompleted < level.skills.length && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">
                        振り返り可
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{level.ageRange} | {level.subtitle}</p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${level.skills.length > 0 ? (levelCompleted / level.skills.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {level.skills.map((skill) => {
                        const isCompleted = completedSkillIds.has(skill.id);
                        const SkillIcon = getSkillIcon(skill.id);
                        return (
                          <motion.div
                            key={skill.id}
                            layout
                            onClick={() => handleToggleSkill(skill)}
                            className={cn(
                              "p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer active:scale-[0.98]",
                              isCompleted
                                ? `${level.borderColor} ${level.bgColor}`
                                : "border-gray-100 bg-white"
                            )}
                            data-testid={`skill-item-${skill.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 mt-0.5",
                                  isCompleted
                                    ? "bg-purple-500 text-white"
                                    : "bg-gray-100 text-gray-400"
                                )}
                                data-testid={`button-skill-${skill.id}`}
                              >
                                {isCompleted ? (
                                  <Award className="w-5 h-5" />
                                ) : (
                                  <SkillIcon className="w-5 h-5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={cn("text-sm font-bold", isCompleted ? "text-purple-700" : "text-gray-800")}>
                                  {skill.title}
                                </span>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{skill.condition}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}

        <div className="text-center pt-2 pb-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            スキルは、ログやWeボードで<br />パートナーと確認しあいながら習得できます
          </p>
        </div>
      </div>

      <AnimatePresence>
        {celebrationSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
            onClick={() => setCelebrationSkill(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl"
              data-testid="dialog-celebration"
            >
              <div className="flex justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setCelebrationSkill(null)}
                  data-testid="button-close-celebration"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-200 to-green-100 flex items-center justify-center mx-auto">
                  <Users className="w-10 h-10 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-purple-800">チームスキル Lv.UP!</h3>
                  <p className="text-base font-bold text-purple-600 mt-1">{celebrationSkill.title}</p>
                </div>

                <div className="bg-purple-50 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-purple-600 mb-1">お祝いメッセージ</p>
                      <p className="text-xs text-purple-700 leading-relaxed font-medium">{celebrationSkill.mioMessage}</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setCelebrationSkill(null)}
                  className="w-full rounded-2xl h-12 font-bold"
                  data-testid="button-close-celebration-ok"
                >
                  ふたりの力だね！
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
