import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Milk, Droplets } from "lucide-react";
import { Link } from "wouter";

const BREAST_TIMER_KEY = "we_iku_breast_timer";
const BREAST_TIMER_TTL_MS = 3 * 60 * 60 * 1000;

const EXPRESS_TIMER_KEY = "we_iku_express_timer";
const EXPRESS_TIMER_TTL_MS = 3 * 60 * 60 * 1000;

function readTimer(key: string, ttl: number) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed.savedAt || Date.now() - new Date(parsed.savedAt).getTime() > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function calcSec(data: any): number {
  if (!data) return 0;
  if (data.paused) return Math.floor((data.accMs ?? 0) / 1000);
  const start = data.startTime ? new Date(data.startTime) : null;
  const elapsed = start
    ? Date.now() - start.getTime() + (data.accMs ?? 0)
    : (data.accMs ?? 0);
  return Math.max(0, Math.floor(elapsed / 1000));
}

export function FloatingBreastTimer() {
  const [location] = useLocation();
  const [breastSec, setBreastSec] = useState(0);
  const [breastActive, setBreastActive] = useState(false);
  const [breastPaused, setBreastPaused] = useState(false);

  const [expressSec, setExpressSec] = useState(0);
  const [expressActive, setExpressActive] = useState(false);
  const [expressPaused, setExpressPaused] = useState(false);

  useEffect(() => {
    const update = () => {
      const bd = readTimer(BREAST_TIMER_KEY, BREAST_TIMER_TTL_MS);
      if (!bd || (!bd.running && !bd.paused)) {
        setBreastActive(false);
      } else {
        setBreastActive(true);
        setBreastPaused(!!bd.paused);
        setBreastSec(calcSec(bd));
      }

      const ed = readTimer(EXPRESS_TIMER_KEY, EXPRESS_TIMER_TTL_MS);
      if (!ed || (!ed.running && !ed.paused)) {
        setExpressActive(false);
      } else {
        setExpressActive(true);
        setExpressPaused(!!ed.paused);
        setExpressSec(calcSec(ed));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const isHome = location === "/" || location === "";

  const fmt = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <AnimatePresence>
      {/* 授乳タイマー */}
      {breastActive && !isHome && (
        <motion.div
          key="floating-breast-timer"
          initial={{ y: 24, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-[76px] right-4 z-[55]"
          data-testid="floating-breast-timer-wrapper"
        >
          <Link href="/">
            <button
              data-testid="floating-breast-timer"
              className={`flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full shadow-xl border-2 backdrop-blur-md transition-colors ${
                breastPaused
                  ? "bg-gray-100/95 dark:bg-gray-800/95 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                  : "bg-pink-50/95 dark:bg-pink-900/80 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  breastPaused ? "bg-gray-400" : "bg-rose-400 animate-pulse"
                }`}
              />
              <Milk className={`w-3.5 h-3.5 shrink-0 ${breastPaused ? "text-gray-400 dark:text-gray-500" : "text-pink-400"}`} />
              <span className="text-sm font-black tabular-nums tracking-tight">
                {fmt(breastSec)}
              </span>
            </button>
          </Link>
        </motion.div>
      )}

      {/* 搾乳タイマー */}
      {expressActive && (
        <motion.div
          key="floating-express-timer"
          initial={{ y: 24, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className={`fixed z-[55] ${breastActive && !isHome ? "bottom-[124px]" : "bottom-[76px]"} right-4`}
          data-testid="floating-express-timer-wrapper"
        >
          <Link href="/">
            <button
              data-testid="floating-express-timer"
              className={`flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full shadow-xl border-2 backdrop-blur-md transition-colors ${
                expressPaused
                  ? "bg-gray-100/95 dark:bg-gray-800/95 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                  : "bg-teal-50/95 dark:bg-teal-900/80 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  expressPaused ? "bg-gray-400" : "bg-teal-400 animate-pulse"
                }`}
              />
              <Droplets className={`w-3.5 h-3.5 shrink-0 ${expressPaused ? "text-gray-400 dark:text-gray-500" : "text-teal-400"}`} />
              <span className="text-sm font-black tabular-nums tracking-tight">
                {fmt(expressSec)}
              </span>
            </button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
