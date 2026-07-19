import { useMemo, useEffect, useRef } from "react";
import { differenceInMinutes, addMinutes, format } from "date-fns";
import { getExcludedDates } from "@/lib/excluded-dates";

export interface FeedingPrediction {
  lastFeedingTime: Date | null;
  lastFeedingMethod: string | null;
  avgIntervalMin: number;
  nextFeedingTime: Date | null;
  minutesUntilNext: number | null;
  hoursUntilNext: number;
  remainingMin: number;
  isOverdue: boolean;
}

const MIN_INTERVAL = 30;
const MAX_INTERVAL = 480;
const DEFAULT_INTERVAL = 180;
const SAMPLE_COUNT = 8;

export function useNextFeedingPrediction(logs: any[]): FeedingPrediction {
  // 授乳（milk）と離乳食（food）の両方を「給餌ログ」として扱う
  const milkLogs = useMemo(() => {
    if (!logs) return [];
    const excludedDates = getExcludedDates();
    return [...logs]
      .filter((l: any) => {
        if (l.type !== "milk" && l.type !== "food") return false;
        if (excludedDates.length === 0) return true;
        const dateStr = format(new Date(l.createdAt), "yyyy-MM-dd");
        return !excludedDates.includes(dateStr);
      })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs]);

  return useMemo(() => {
    // 手動設定の目標間隔（0 = 自動計算）
    const targetIntervalMin = parseInt(localStorage.getItem("feedingTargetIntervalMin") || "0", 10);

    if (milkLogs.length === 0) {
      const intervalMin = targetIntervalMin > 0 ? targetIntervalMin : DEFAULT_INTERVAL;
      return {
        lastFeedingTime: null,
        lastFeedingMethod: null,
        avgIntervalMin: intervalMin,
        nextFeedingTime: null,
        minutesUntilNext: null,
        hoursUntilNext: 0,
        remainingMin: 0,
        isOverdue: false,
      };
    }

    const lastLog = milkLogs[0];
    const lastFeedingTime = new Date(lastLog.createdAt);

    let lastFeedingMethod: string | null = null;
    if (lastLog.type === "food") {
      lastFeedingMethod = "離乳食";
    } else if (lastLog.type === "milk") {
      const sub = lastLog.subType;
      const left = lastLog.breastLeftMin ?? 0;
      const right = lastLog.breastRightMin ?? 0;
      if (sub === "formula") {
        lastFeedingMethod = "ミルク";
      } else if (sub === "mixed") {
        lastFeedingMethod = "混合";
      } else {
        // breast or no subType
        if (left > 0 && right > 0) lastFeedingMethod = "両側";
        else if (left > 0) lastFeedingMethod = "左胸";
        else if (right > 0) lastFeedingMethod = "右胸";
        else lastFeedingMethod = "母乳";
      }
    }

    let avgIntervalMin: number;
    if (targetIntervalMin > 0) {
      // 手動設定を優先
      avgIntervalMin = targetIntervalMin;
    } else {
      // 過去の記録から平均を計算
      const intervals: number[] = [];
      const count = Math.min(SAMPLE_COUNT, milkLogs.length - 1);
      for (let i = 0; i < count; i++) {
        const diff = differenceInMinutes(
          new Date(milkLogs[i].createdAt),
          new Date(milkLogs[i + 1].createdAt)
        );
        if (diff >= MIN_INTERVAL && diff <= MAX_INTERVAL) {
          intervals.push(diff);
        }
      }
      avgIntervalMin =
        intervals.length > 0
          ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
          : DEFAULT_INTERVAL;
    }

    const nextFeedingTime = addMinutes(lastFeedingTime, avgIntervalMin);
    const minutesUntilNext = differenceInMinutes(nextFeedingTime, new Date());
    const isOverdue = minutesUntilNext < 0;
    const absMin = Math.abs(minutesUntilNext);
    const hoursUntilNext = Math.floor(absMin / 60);
    const remainingMin = absMin % 60;

    return {
      lastFeedingTime,
      lastFeedingMethod,
      avgIntervalMin,
      nextFeedingTime,
      minutesUntilNext,
      hoursUntilNext,
      remainingMin,
      isOverdue,
    };
  }, [milkLogs]);
}

export function useFeedingNotification(prediction: FeedingPrediction) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSettings = () => ({
    enabled: localStorage.getItem("feedingNotifyEnabled") === "true",
    minutesBefore: parseInt(localStorage.getItem("feedingNotifyMinutes") || "10", 10),
  });

  const requestPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  };

  const scheduleNotification = (nextFeedingTime: Date, minutesBefore: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const notifyAt = addMinutes(nextFeedingTime, -minutesBefore);
    const msUntilNotify = notifyAt.getTime() - Date.now();
    if (msUntilNotify <= 0) return;

    timerRef.current = setTimeout(() => {
      if (Notification.permission === "granted") {
        new Notification("We育 授乳アラーム", {
          body: `約${minutesBefore}分後に授乳の時間です（予定: ${format(nextFeedingTime, "HH:mm")}）`,
          icon: "/icon-192.png",
          tag: "feeding-alert",
        });
      }
    }, msUntilNotify);
  };

  useEffect(() => {
    const { enabled, minutesBefore } = getSettings();
    if (!enabled || !prediction.nextFeedingTime) return;

    requestPermission().then((granted) => {
      if (granted && prediction.nextFeedingTime) {
        scheduleNotification(prediction.nextFeedingTime, minutesBefore);
      }
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prediction.nextFeedingTime?.getTime()]);
}
