import { Header } from "@/components/Header";
import { SosButton } from "@/components/SosButton";
import { QuickActions } from "@/components/ActionButtons";
import { WeBoard } from "@/components/WeBoard";
import { BottomNav } from "@/components/Navigation";
import { useSettings, useLogs, useEvents, useActiveSleepSession, useSleepSessions, useNotifications, useMarkNotificationRead } from "@/hooks/use-app-data";
import { useActiveChild } from "@/hooks/use-active-child";
import { useNextFeedingPrediction, useFeedingNotification } from "@/hooks/use-feeding-notification";
import { useState, useEffect, useMemo } from "react";
import { differenceInDays, differenceInMonths, differenceInMinutes, parseISO, addYears, format, isAfter, isSameDay, startOfDay, addMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gem, Moon, Heart, Sprout, TreePine, Apple, Leaf, Zap, ChevronRight, Clock, AlertCircle, Milk, Baby, Sun, Droplets, UtensilsCrossed, MessageCircle, CalendarCheck, CalendarDays, Award, Stethoscope, Users, BellRing, EyeOff, Eye, CircleDot } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [familyId, setFamilyId] = useState(localStorage.getItem("familyId") || "default");
  const [showWeBoard] = useState(() => localStorage.getItem("showWeBoard") !== "false");
  const [showSkillTree] = useState(() => localStorage.getItem("showSkillTree") !== "false");
  const [showWakeWindow, setShowWakeWindow] = useState(
    localStorage.getItem("wakeWindowVisible") !== "false"
  );
  const { data: settings, isLoading: isSettingsLoading } = useSettings(familyId);
  const { data: allLogs, isLoading: isLogsLoading } = useLogs(familyId);
  const { data: events = [] } = useEvents(familyId);
  const { data: allSleepSessions = [] } = useSleepSessions(familyId);
  const userId = localStorage.getItem("userType") || "papa";
  const { data: notifList = [] } = useNotifications(familyId, userId);
  const markRead = useMarkNotificationRead();
  const { children: childrenList, activeChild, activeChildId, switchChild } = useActiveChild(familyId, settings);
  const { data: activeSession } = useActiveSleepSession(familyId, activeChildId);

  const logs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!activeChildId) return allLogs;
    return allLogs.filter((l: any) => !l.childId || l.childId === activeChildId);
  }, [allLogs, activeChildId]);

  const sleepSessions = useMemo(() => {
    if (!activeChildId) return allSleepSessions;
    return allSleepSessions.filter((s: any) => !s.childId || s.childId === activeChildId);
  }, [allSleepSessions, activeChildId]);

  const totalPoints = logs?.reduce((sum: number, log: any) => sum + (log.points || 0), 0) || 0;
  const thanksCount = logs?.filter((log: any) => log.type === 'thanks').length || 0;

  const birthdayStr = activeChild?.birthday || settings?.babyBirthday;
  const birthday = birthdayStr ? parseISO(birthdayStr) : new Date();
  const firstBirthday = addYears(birthday, 1);
  const daysOld = Math.max(0, differenceInDays(new Date(), birthday));
  const daysUntilBirthday = Math.max(0, differenceInDays(firstBirthday, new Date()));
  
  const teamPower = Math.round((totalPoints + thanksCount * 5) / Math.max(1, daysOld));

  const childAgeMonths = birthdayStr ? differenceInMonths(new Date(), parseISO(birthdayStr)) : 0;
  const childAgeYears = Math.floor(childAgeMonths / 12);
  const childAgeRemMonths = childAgeMonths % 12;
  const ageDisplay = childAgeMonths < 12
    ? `生後${childAgeMonths}ヶ月`
    : childAgeRemMonths === 0
    ? `${childAgeYears}歳`
    : `${childAgeYears}歳${childAgeRemMonths}ヶ月`;
  const agePhase: "infant" | "toddler" | "kids" = childAgeMonths < 12 ? "infant" : childAgeMonths < 48 ? "toddler" : "kids";

  const today = startOfDay(new Date());
  const upcomingEvents = events
    .filter((e: any) => !e.completed && (isAfter(parseISO(e.date), today) || isSameDay(parseISO(e.date), today)))
    .sort((a: any, b: any) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
    .slice(0, 2);


  const months = birthdayStr ? differenceInMonths(new Date(), parseISO(birthdayStr)) : 0;

  const isSleeping = activeSession?.id && !activeSession?.endedAt;

  const [sleepTimerMin, setSleepTimerMin] = useState(0);
  useEffect(() => {
    if (!isSleeping) return;
    const update = () => {
      const mins = differenceInMinutes(new Date(), new Date(activeSession.startedAt));
      setSleepTimerMin(Math.max(0, mins));
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [isSleeping, activeSession]);

  const lastCompletedSession = useMemo(() => {
    if (!sleepSessions || sleepSessions.length === 0) return null;
    const completed = sleepSessions.filter((s: any) => s.endedAt);
    if (completed.length === 0) return null;
    return completed[0];
  }, [sleepSessions]);

  const [wakeTick, setWakeTick] = useState(0);
  useEffect(() => {
    if (!lastCompletedSession || isSleeping) return;
    const interval = setInterval(() => setWakeTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [lastCompletedSession, isSleeping]);
  const wakeMinutes = useMemo(() => {
    if (!lastCompletedSession || isSleeping) return 0;
    return Math.max(0, differenceInMinutes(new Date(), new Date(lastCompletedSession.endedAt)));
  }, [lastCompletedSession, isSleeping, wakeTick]);

  const wakeWindowMinutes = useMemo(() => {
    if (months <= 1) return { min: 40, max: 60 };
    if (months <= 3) return { min: 60, max: 80 };
    if (months <= 6) return { min: 90, max: 120 };
    if (months <= 9) return { min: 120, max: 180 };
    if (months <= 12) return { min: 180, max: 240 };
    return { min: 240, max: 300 };
  }, [months]);

  const nextNapTime = useMemo(() => {
    if (!lastCompletedSession || isSleeping) return null;
    const wokeAt = new Date(lastCompletedSession.endedAt);
    return addMinutes(wokeAt, wakeWindowMinutes.max);
  }, [lastCompletedSession, isSleeping, wakeWindowMinutes]);

  const minutesUntilNap = useMemo(() => {
    if (!nextNapTime) return null;
    return differenceInMinutes(nextNapTime, new Date());
  }, [nextNapTime, wakeMinutes]);

  const wakeWindowAlert = useMemo(() => {
    if (!lastCompletedSession || isSleeping || wakeMinutes < 0) return null;
    const warnMin = wakeWindowMinutes.min;
    const maxMin = wakeWindowMinutes.max;
    const preWarnMin = Math.max(warnMin, maxMin - 15);

    if (wakeMinutes >= maxMin) {
      return {
        level: "urgent" as const,
        message: "ねんねのタイミングかもしれません。焦らずに、できそうなら部屋を少し暗くしてみましょう。",
      };
    }

    if (wakeMinutes >= preWarnMin) {
      return {
        level: "warning" as const,
        message: "もうすぐねんねのタイミングです。準備ができたらゆっくり始めましょう。",
      };
    }

    if (wakeMinutes >= warnMin) {
      return {
        level: "info" as const,
        message: "そろそろねんねの準備を始めてもよい頃です。",
      };
    }

    return null;
  }, [wakeMinutes, months, lastCompletedSession, isSleeping, wakeWindowMinutes]);

  const todayMilkLogs = useMemo(() => {
    if (!logs) return [];
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) => l.type === "milk" && new Date(l.createdAt) >= todayStart);
  }, [logs]);

  const todayMilkMl = useMemo(() => {
    return todayMilkLogs.reduce((sum: number, l: any) => {
      return sum + (l.formulaMl || 0) + (l.expressedMl || 0);
    }, 0);
  }, [todayMilkLogs]);

  const todayFormulaMl = useMemo(() => {
    return todayMilkLogs.reduce((sum: number, l: any) => sum + (l.formulaMl || 0), 0);
  }, [todayMilkLogs]);

  const todayExpressedMl = useMemo(() => {
    return todayMilkLogs.reduce((sum: number, l: any) => sum + (l.expressedMl || 0), 0);
  }, [todayMilkLogs]);

  const todayBreastCount = useMemo(() => {
    return todayMilkLogs.filter((l: any) => l.subType === "breast" || l.subType === "mixed").length;
  }, [todayMilkLogs]);

  const todayDiaperCount = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) => l.type === "diaper" && new Date(l.createdAt) >= todayStart).length;
  }, [logs]);

  const todayPeeCount = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) =>
      l.type === "diaper" &&
      new Date(l.createdAt) >= todayStart &&
      (l.subType === "pee" || l.subType === "both")
    ).length;
  }, [logs]);

  const todayPoopCount = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) =>
      l.type === "diaper" &&
      new Date(l.createdAt) >= todayStart &&
      (l.subType === "poop" || l.subType === "both")
    ).length;
  }, [logs]);

  const todaySleepMinutes = useMemo(() => {
    if (!sleepSessions) return 0;
    const todayStart = startOfDay(new Date());
    let total = 0;
    for (const s of sleepSessions as any[]) {
      if (!s.endedAt) continue;
      const end = new Date(s.endedAt);
      if (end <= todayStart) continue;
      const start = new Date(s.startedAt);
      const effectiveStart = start < todayStart ? todayStart : start;
      total += differenceInMinutes(end, effectiveStart);
    }
    return total;
  }, [sleepSessions]);

  const todayToiletSuccess = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) => l.type === "toilet" && new Date(l.createdAt) >= todayStart && l.subType !== "accident").length;
  }, [logs]);

  const todayMealCount = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) => l.type === "meal" && new Date(l.createdAt) >= todayStart).length;
  }, [logs]);

  const latestWord = useMemo(() => {
    if (!logs) return null;
    const wordLogs = logs.filter((l: any) => l.type === "words");
    if (wordLogs.length === 0) return null;
    const latest = wordLogs[wordLogs.length - 1];
    const msg = latest?.subType || latest?.message || null;
    if (!msg) return null;
    return msg.startsWith("ことば: ") ? msg.replace("ことば: ", "") : msg;
  }, [logs]);

  const feedingPrediction = useNextFeedingPrediction(logs || []);
  useFeedingNotification(feedingPrediction);
  const notifyEnabled = localStorage.getItem("feedingNotifyEnabled") === "true";

  const todayScheduleDone = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEvents = events.filter((e: any) => isSameDay(parseISO(e.date), todayStart));
    const done = todayEvents.filter((e: any) => e.completed).length;
    const total = todayEvents.length;
    return { done, total };
  }, [events]);

  const todayAchievementCount = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) => l.type === "achievement" && new Date(l.createdAt) >= todayStart).length;
  }, [logs]);

  const todayHealthNotes = useMemo(() => {
    if (!logs) return 0;
    const todayStart = startOfDay(new Date());
    return logs.filter((l: any) => (l.type === "temp" || l.type === "symptom" || l.type === "medicine") && new Date(l.createdAt) >= todayStart).length;
  }, [logs]);

  const GrowthIcon = daysOld < 100 ? Sprout : daysOld < 200 ? Leaf : daysOld < 300 ? TreePine : Apple;


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-green-50/50 pb-24 font-sans">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden">
        <Header />

        <AnimatePresence>
          {notifList.filter((n: any) => {
            if (n.read) return false;
            if (n.type === "sleep_success") return false;
            if (!activeChildId) return true;
            if (n.childId) return n.childId === activeChildId;
            const childSpecificTypes = ["thanks"];
            if (childSpecificTypes.includes(n.type)) return false;
            return true;
          }).map((notif: any) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="px-8 pt-2"
            >
              <div className="bg-pink-50 border-2 border-pink-200 rounded-3xl p-3 flex items-center gap-3" data-testid={`notification-${notif.id}`}>
                <div className="p-2 rounded-2xl bg-pink-100">
                  <Heart className="w-5 h-5 text-pink-500" />
                </div>
                <p className="flex-1 text-sm font-bold text-pink-700">{notif.message}</p>
                <button
                  data-testid={`button-dismiss-notification-${notif.id}`}
                  onClick={() => markRead.mutate(notif.id)}
                  className="p-1.5 rounded-full hover:bg-pink-100 transition-colors"
                >
                  <X className="w-4 h-4 text-pink-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        <div className="px-8 pt-2 pb-2">
          <Link href="/child-profile" data-testid="link-age-badge">
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-white shadow-sm overflow-hidden relative">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase" data-testid="text-age-label">
                    {agePhase === "infant" ? "すくすく成長中" : agePhase === "toddler" ? "ぐんぐん成長中" : "もうすぐ小学生"}
                  </p>
                  <p className="text-lg font-black text-gray-700" data-testid="text-age-display">
                    現在 <span className="text-2xl" style={{ color: activeChild?.color || "#805AAA" }}>{ageDisplay}</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <GrowthIcon className="w-6 h-6 text-green-500" />
                </div>
              </div>
              {agePhase === "infant" && daysUntilBirthday > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] text-gray-400 font-bold mb-1">1歳の誕生日まであと{daysUntilBirthday}日</p>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (daysOld / 365) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </Link>
        </div>

        <div className="px-8 pt-2 space-y-4">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-white shadow-sm" data-testid="card-today-stats">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Today's Summary</p>
            {agePhase === "infant" && (
              <div className="grid grid-cols-5 gap-1">
                <div className="text-center">
                  <div className="w-7 h-7 mx-auto rounded-full bg-indigo-50 flex items-center justify-center mb-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <p className="text-base font-black text-gray-700 leading-tight" data-testid="text-today-sleep-time">
                    {todaySleepMinutes >= 60
                      ? <>{Math.floor(todaySleepMinutes / 60)}<span className="text-[10px] font-bold text-gray-400">h</span>{todaySleepMinutes % 60 > 0 ? <>{todaySleepMinutes % 60}<span className="text-[10px] font-bold text-gray-400">m</span></> : null}</>
                      : <>{todaySleepMinutes}<span className="text-[10px] font-bold text-gray-400">m</span></>
                    }
                  </p>
                  <p className="text-[8px] text-gray-400 font-bold">睡眠</p>
                </div>
                <div className="text-center">
                  <div className="w-7 h-7 mx-auto rounded-full bg-pink-50 flex items-center justify-center mb-1">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <p className="text-base font-black text-gray-700 leading-tight" data-testid="text-today-breast-count">{todayBreastCount}<span className="text-[10px] font-bold text-gray-400">回</span></p>
                  <p className="text-[8px] text-gray-400 font-bold">母乳</p>
                </div>
                <div className="text-center">
                  <div className="w-7 h-7 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-1">
                    <Milk className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-base font-black text-gray-700 leading-tight" data-testid="text-today-milk-ml">{todayMilkMl}<span className="text-[10px] font-bold text-gray-400">ml</span></p>
                  {todayFormulaMl > 0 && todayExpressedMl > 0 ? (
                    <p className="text-[7px] text-gray-400 font-bold leading-tight" data-testid="text-milk-breakdown">
                      粉{todayFormulaMl}/搾{todayExpressedMl}
                    </p>
                  ) : (
                    <p className="text-[8px] text-gray-400 font-bold">
                      {todayFormulaMl > 0 ? "粉" : todayExpressedMl > 0 ? "搾乳" : "ミルク"}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <div className="w-7 h-7 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-base font-black text-blue-600 leading-tight" data-testid="text-today-pee-count">{todayPeeCount}</p>
                  <p className="text-[8px] text-gray-400 font-bold">おしっこ</p>
                </div>
                <div className="text-center">
                  <div className="w-7 h-7 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-1">
                    <CircleDot className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <p className="text-base font-black text-amber-600 leading-tight" data-testid="text-today-poop-count">{todayPoopCount}</p>
                  <p className="text-[8px] text-gray-400 font-bold">うんち</p>
                </div>
              </div>
            )}
            {agePhase === "toddler" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-cyan-50 flex items-center justify-center mb-1">
                    <Droplets className="w-4 h-4 text-cyan-500" />
                  </div>
                  <p className="text-lg font-black text-gray-700" data-testid="text-today-toilet">{todayToiletSuccess}</p>
                  <p className="text-[9px] text-gray-400 font-bold">トイレ成功</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-1">
                    <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-lg font-black text-gray-700" data-testid="text-today-meal">{todayMealCount}</p>
                  <p className="text-[9px] text-gray-400 font-bold">食事回数</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-1">
                    <MessageCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-lg font-black text-gray-700 truncate text-sm" data-testid="text-latest-word">
                    {latestWord || "-"}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold">最新のことば</p>
                </div>
              </div>
            )}
            {agePhase === "kids" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-violet-50 flex items-center justify-center mb-1">
                    <CalendarCheck className="w-4 h-4 text-violet-500" />
                  </div>
                  <p className="text-lg font-black text-gray-700" data-testid="text-today-schedule">
                    {todayScheduleDone.done}<span className="text-xs text-gray-400">/{todayScheduleDone.total}</span>
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold">今日の予定</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-1">
                    <Award className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-lg font-black text-gray-700" data-testid="text-today-achievement">{todayAchievementCount}</p>
                  <p className="text-[9px] text-gray-400 font-bold">できた!</p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto rounded-full bg-teal-50 flex items-center justify-center mb-1">
                    <Stethoscope className="w-4 h-4 text-teal-500" />
                  </div>
                  <p className="text-lg font-black text-gray-700" data-testid="text-today-health">{todayHealthNotes}</p>
                  <p className="text-[9px] text-gray-400 font-bold">健康メモ</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {agePhase === "infant" && feedingPrediction.lastFeedingTime && (
          <div className="px-8 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl p-4 border-2 shadow-sm ${
                feedingPrediction.isOverdue
                  ? "bg-pink-50 border-pink-200"
                  : feedingPrediction.minutesUntilNext !== null && feedingPrediction.minutesUntilNext < 30
                  ? "bg-amber-50 border-amber-200"
                  : "bg-pink-50/60 border-pink-100"
              }`}
              data-testid="card-next-feeding"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-2xl ${feedingPrediction.isOverdue ? "bg-pink-200" : "bg-pink-100"}`}>
                    <Heart className={`w-5 h-5 ${feedingPrediction.isOverdue ? "text-pink-500" : "text-pink-500"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Next Feeding</p>
                    {feedingPrediction.isOverdue ? (
                      <p className="text-sm font-black text-pink-600 dark:text-pink-200" data-testid="text-next-feeding-overdue">
                        そろそろ授乳の時間かもしれません
                      </p>
                    ) : feedingPrediction.minutesUntilNext !== null && feedingPrediction.minutesUntilNext < 60 ? (
                      <p className="text-sm font-black text-amber-700 dark:text-amber-200" data-testid="text-next-feeding-soon">
                        あと約{feedingPrediction.minutesUntilNext}分
                      </p>
                    ) : (
                      <p className="text-sm font-black text-pink-700 dark:text-pink-200" data-testid="text-next-feeding-time">
                        あと約{feedingPrediction.hoursUntilNext > 0 ? `${feedingPrediction.hoursUntilNext}時間` : ""}{feedingPrediction.remainingMin > 0 ? `${feedingPrediction.remainingMin}分` : ""}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-100 font-bold mt-0.5">
                      予定 {format(feedingPrediction.nextFeedingTime!, "HH:mm")}
                      {" · "}前回 {format(feedingPrediction.lastFeedingTime, "HH:mm")}
                      {feedingPrediction.lastFeedingMethod && (
                        <span className="ml-1 text-pink-500 dark:text-pink-300">({feedingPrediction.lastFeedingMethod})</span>
                      )}
                    </p>
                  </div>
                </div>
                {notifyEnabled && (
                  <div className="shrink-0 ml-2">
                    <BellRing className="w-4 h-4 text-pink-400" />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {childAgeMonths < 36 && isSleeping && (
          <div className="px-8 pt-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-3xl p-4 border-2 border-indigo-200 shadow-sm"
              data-testid="card-sleeping-now"
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-200 p-2.5 rounded-2xl">
                  <Moon className="w-5 h-5 text-indigo-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Now Sleeping</p>
                  <p className="text-lg font-black text-indigo-800" data-testid="text-sleeping-timer">
                    今、{Math.floor(sleepTimerMin / 60) > 0 ? `${Math.floor(sleepTimerMin / 60)}時間` : ""}{sleepTimerMin % 60}分ねんね中
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {childAgeMonths < 36 && !isSleeping && lastCompletedSession && !showWakeWindow && (
          <div className="px-8 pt-2">
            <button
              data-testid="button-show-wake-window"
              onClick={() => { setShowWakeWindow(true); localStorage.setItem("wakeWindowVisible", "true"); }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              活動時間を表示する
            </button>
          </div>
        )}

        {childAgeMonths < 36 && !isSleeping && lastCompletedSession && showWakeWindow && (
          <div className="px-8 pt-2">
            <div className={`rounded-3xl p-4 border-2 shadow-sm transition-all ${
              wakeWindowAlert?.level === "urgent" 
                ? "bg-purple-50/80 border-purple-200" 
                : wakeWindowAlert?.level === "warning"
                ? "bg-indigo-50/80 border-indigo-200"
                : "bg-white/60 border-indigo-100"
            }`} data-testid="card-wake-window">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${
                  wakeWindowAlert?.level === "urgent" ? "bg-purple-100" :
                  wakeWindowAlert?.level === "warning" ? "bg-indigo-100" : "bg-indigo-50"
                }`}>
                  <Clock className={`w-5 h-5 ${
                    wakeWindowAlert?.level === "urgent" ? "text-purple-500" :
                    wakeWindowAlert?.level === "warning" ? "text-indigo-500" : "text-indigo-500"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wake Window</p>
                  <p className="text-lg font-black text-gray-700" data-testid="text-wake-time">
                    {Math.floor(wakeMinutes / 60) > 0 ? `${Math.floor(wakeMinutes / 60)}時間` : ""}{wakeMinutes % 60}分 起きてます
                  </p>
                </div>
                <button
                  data-testid="button-hide-wake-window"
                  onClick={() => { setShowWakeWindow(false); localStorage.setItem("wakeWindowVisible", "false"); }}
                  className="p-1.5 rounded-xl text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                  aria-label="非表示にする"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>

              {nextNapTime && (
                <div className={`mt-3 rounded-2xl p-3 ${
                  wakeWindowAlert?.level === "urgent" 
                    ? "bg-purple-100/60 dark:bg-purple-950/60" 
                    : wakeWindowAlert?.level === "warning"
                    ? "bg-indigo-100/60 dark:bg-indigo-950/60"
                    : "bg-indigo-50/80 dark:bg-indigo-950/50"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className={`w-4 h-4 ${
                        wakeWindowAlert?.level === "urgent" ? "text-purple-400 dark:text-purple-200" :
                        wakeWindowAlert?.level === "warning" ? "text-indigo-400 dark:text-indigo-200" : "text-indigo-400 dark:text-indigo-200"
                      }`} />
                      <span className="text-xs font-bold text-gray-500 dark:text-white">次のねんね予想</span>
                    </div>
                    <span className={`text-lg font-black ${
                      wakeWindowAlert?.level === "urgent" ? "text-purple-700 dark:text-white" :
                      wakeWindowAlert?.level === "warning" ? "text-indigo-700 dark:text-white" : "text-indigo-700 dark:text-white"
                    }`} data-testid="text-next-nap-time">
                      {format(nextNapTime, "H:mm")}ごろ
                    </span>
                  </div>
                  {minutesUntilNap !== null && minutesUntilNap > 0 && (
                    <p className="text-xs font-bold text-gray-500 dark:text-indigo-100 mt-1 text-right" data-testid="text-nap-countdown">
                      あと約{minutesUntilNap}分
                    </p>
                  )}
                  {minutesUntilNap !== null && minutesUntilNap <= 0 && (
                    <p className="text-xs font-bold text-purple-500 dark:text-purple-100 mt-1 text-right" data-testid="text-nap-overdue">
                      予想時刻が過ぎました。焦らず大丈夫です。
                    </p>
                  )}
                </div>
              )}

              {wakeWindowAlert && (
                <div className={`mt-2 pt-2 border-t ${
                  wakeWindowAlert.level === "urgent" ? "border-purple-200 dark:border-purple-800" : 
                  wakeWindowAlert.level === "warning" ? "border-indigo-200 dark:border-indigo-800" : "border-indigo-100 dark:border-indigo-800"
                }`}>
                  <p className={`text-xs font-bold ${
                    wakeWindowAlert.level === "urgent" ? "text-purple-600 dark:text-purple-50" : 
                    wakeWindowAlert.level === "warning" ? "text-indigo-600 dark:text-indigo-50" : "text-indigo-600 dark:text-indigo-50"
                  }`} data-testid="text-wake-advice">
                    {wakeWindowAlert.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {upcomingEvents.length > 0 && (
          <div className="px-8 pt-2">
            <Link href="/calendar" className="block" data-testid="link-upcoming-events">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-4 border-2 border-violet-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-violet-100 p-1.5 rounded-xl">
                      <CalendarDays className="w-4 h-4 text-violet-500" />
                    </div>
                    <p className="text-sm font-black text-gray-700 tracking-wide">近日の予定</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                </div>
                <div className="space-y-2">
                  {upcomingEvents.map((event: any) => (
                    <div key={event.id} className="flex items-center gap-3 bg-violet-50/60 rounded-2xl px-3 py-2" data-testid={`upcoming-event-${event.id}`}>
                      <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                      <span className="text-sm font-bold text-gray-700 truncate flex-1">{event.title}</span>
                      <span className="text-xs font-bold text-violet-500 shrink-0 bg-violet-100 rounded-xl px-2 py-0.5">
                        {format(parseISO(event.date), "M/d（E）", { locale: ja })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          </div>
        )}

        <main className="flex-1 flex flex-col items-center w-full z-10">
          <section className="w-full mb-8">
            <div className="px-8 mb-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-700 text-lg">クイックログ</h3>
            </div>
            <QuickActions />
          </section>

          <div className="px-8 mb-6 w-full">
            <Link href="/timeline" className="block" data-testid="link-timeline">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-3xl p-4 border-2 border-purple-100 shadow-sm hover-elevate">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2.5 rounded-2xl">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-sm text-purple-800">24時間タイムライン</p>
                    <p className="text-[10px] text-purple-500 mt-0.5">
                      {agePhase === "infant" ? "睡眠・ミルク・おむつを一目で確認" : agePhase === "toddler" ? "食事・トイレ・睡眠を一目で確認" : "予定・できたね・記録を一目で確認"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            </Link>
          </div>

          <div className="px-8 mb-6 w-full">
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-4 flex items-center justify-between border-2 border-purple-100 shadow-sm">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-purple-500 animate-bounce" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Team Power</p>
                  <p className="text-xl font-black text-purple-600 tracking-tighter">{teamPower}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-purple-100" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Points</p>
                <p className="text-xl font-black text-purple-600 tracking-tighter">{totalPoints} pt</p>
              </div>
            </div>
          </div>

          {agePhase === "infant" && <SosButton />}

          <div className="px-8 mb-6 w-full">
            <Link href="/health" className="block" data-testid="link-health">
              <div className="bg-gradient-to-r from-teal-50 to-green-50 rounded-3xl p-4 border-2 border-teal-100 shadow-sm hover-elevate">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-100 p-2.5 rounded-2xl">
                    <Heart className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-sm text-teal-800">健康・成長記録</p>
                    <p className="text-[10px] text-teal-500 mt-0.5">体温・おむつ詳細・症状メモ・成長曲線</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-teal-400" />
                </div>
              </div>
            </Link>
          </div>

          {showSkillTree && (
            <div className="px-8 mb-6 w-full">
              <Link href="/skills" className="block" data-testid="link-skills">
                <div className="bg-gradient-to-r from-purple-50 to-green-50 rounded-3xl p-4 border-2 border-purple-100 shadow-sm hover-elevate">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2.5 rounded-2xl">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-purple-800">チーム育児スキル</p>
                      <p className="text-[10px] text-purple-500 mt-0.5">ふたりの経験値を確認する</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
              </Link>
            </div>
          )}

          {agePhase === "infant" && activeChild?.sleepTrainingEnabled !== false && (
            <div className="px-8 mb-6 w-full">
              <Link href="/sleep-training" className="block" data-testid="link-sleep-training">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-4 border-2 border-indigo-100 shadow-sm hover-elevate">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2.5 rounded-2xl">
                      <Moon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-indigo-800">ネントレ支援</p>
                      <p className="text-[10px] text-indigo-500 mt-0.5">環境チェック・ルーティン・見守りタイマー</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-400" />
                  </div>
                </div>
              </Link>
            </div>
          )}

          <div className="px-8 mb-6 w-full">
            <Link href="/dashboard" className="block" data-testid="link-dashboard">
              <div className="bg-gradient-to-r from-purple-50 to-rose-50 rounded-3xl p-4 border-2 border-purple-100 shadow-sm hover-elevate">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2.5 rounded-2xl">
                    <Gem className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-sm text-purple-800">貢献度ダッシュボード</p>
                    <p className="text-[10px] text-purple-500 mt-0.5">ふたりの育児をグラフで可視化</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            </Link>
          </div>

          {showWeBoard && <WeBoard familyId={familyId} />}

        </main>
      </div>

      <BottomNav />
    </div>
  );
}
