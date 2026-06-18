import { format } from "date-fns";

const STORAGE_KEY = "we_iku_excluded_dates";

export function getExcludedDates(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function setExcludedDates(dates: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
}

export function toggleExcludedDate(dateStr: string): string[] {
  const current = getExcludedDates();
  const next = current.includes(dateStr)
    ? current.filter((d) => d !== dateStr)
    : [...current, dateStr];
  setExcludedDates(next);
  return next;
}

export function isDateExcluded(date: Date, excludedDates: string[]): boolean {
  return excludedDates.includes(format(date, "yyyy-MM-dd"));
}

export function toDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
