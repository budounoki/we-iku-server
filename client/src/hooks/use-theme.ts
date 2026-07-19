import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "we_iku_theme_mode";
const AUTO_START_KEY = "we_iku_theme_auto_start";
const AUTO_END_KEY = "we_iku_theme_auto_end";

const DEFAULT_START = 18;
const DEFAULT_END = 6;

function readHour(key: string, fallback: number): number {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0 || n > 23) return fallback;
  return n;
}

let _autoStart = readHour(AUTO_START_KEY, DEFAULT_START);
let _autoEnd = readHour(AUTO_END_KEY, DEFAULT_END);

function isDarkByTime(): boolean {
  const hour = new Date().getHours();
  if (_autoStart === _autoEnd) return false;
  if (_autoStart < _autoEnd) {
    return hour >= _autoStart && hour < _autoEnd;
  }
  return hour >= _autoStart || hour < _autoEnd;
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "light") {
    root.classList.remove("dark");
  } else {
    if (isDarkByTime()) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

let _mode: ThemeMode = (() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "auto") return saved;
  return "light";
})();

const _listeners = new Set<(mode: ThemeMode) => void>();
const _autoListeners = new Set<(start: number, end: number) => void>();

function setGlobalMode(newMode: ThemeMode) {
  _mode = newMode;
  localStorage.setItem(STORAGE_KEY, newMode);
  applyTheme(newMode);
  _listeners.forEach((fn) => fn(newMode));
}

function setGlobalAutoHours(start: number, end: number) {
  _autoStart = start;
  _autoEnd = end;
  localStorage.setItem(AUTO_START_KEY, String(start));
  localStorage.setItem(AUTO_END_KEY, String(end));
  applyTheme(_mode);
  _autoListeners.forEach((fn) => fn(start, end));
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(_mode);
  const [autoStart, setAutoStartState] = useState<number>(_autoStart);
  const [autoEnd, setAutoEndState] = useState<number>(_autoEnd);

  useEffect(() => {
    const handler = (m: ThemeMode) => setModeState(m);
    const autoHandler = (s: number, e: number) => {
      setAutoStartState(s);
      setAutoEndState(e);
    };
    _listeners.add(handler);
    _autoListeners.add(autoHandler);
    applyTheme(_mode);
    return () => {
      _listeners.delete(handler);
      _autoListeners.delete(autoHandler);
    };
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    const checkAndApply = () => applyTheme("auto");
    const interval = setInterval(checkAndApply, 60000);
    return () => clearInterval(interval);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setGlobalMode(newMode);
  }, []);

  const setAutoHours = useCallback((start: number, end: number) => {
    setGlobalAutoHours(start, end);
  }, []);

  const isDark = document.documentElement.classList.contains("dark");

  return { mode, setMode, isDark, autoStart, autoEnd, setAutoHours };
}
