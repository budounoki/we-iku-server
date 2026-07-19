import { useRef, useEffect, useState } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";

const ITEM_H = 40;
const VISIBLE = 3;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

interface ScrollColumnProps {
  items: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  flex?: number;
}

function ScrollColumn({ items, selectedIdx, onSelect, flex = 1 }: ScrollColumnProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveIdx, setLiveIdx] = useState(selectedIdx);

  useEffect(() => {
    setLiveIdx(selectedIdx);
    const el = elRef.current;
    if (!el) return;
    const target = selectedIdx * ITEM_H;
    if (Math.abs(el.scrollTop - target) < 2) return;
    programmatic.current = true;
    el.scrollTo({ top: target, behavior: "smooth" });
    const t = setTimeout(() => { programmatic.current = false; }, 600);
    return () => clearTimeout(t);
  }, [selectedIdx]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.scrollTop = selectedIdx * ITEM_H;
    setLiveIdx(selectedIdx);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = elRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    setLiveIdx(clamped);
    if (!programmatic.current) {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        onSelect(clamped);
      }, 120);
    }
  };

  return (
    <div className="relative overflow-hidden" style={{ flex, height: VISIBLE * ITEM_H, minWidth: 0 }}>
      <div
        className="absolute inset-x-1 bg-gray-100 dark:bg-gray-700 pointer-events-none z-10 rounded-xl"
        style={{ top: PAD, height: ITEM_H }}
      />
      <div
        className="absolute inset-x-0 top-0 z-20 pointer-events-none"
        style={{ height: 28, background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
        style={{ height: 28, background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
      />
      <div
        ref={elRef}
        className="h-full no-scrollbar relative z-[15]"
        style={{
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
        onScroll={handleScroll}
      >
        <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
          {items.map((item, i) => {
            const dist = Math.abs(i - liveIdx);
            return (
              <div
                key={i}
                style={{ height: ITEM_H, scrollSnapAlign: "center" }}
                className={`flex items-center justify-center select-none transition-all duration-100 ${
                  dist === 0
                    ? "text-gray-900 font-black text-[22px]"
                    : dist === 1
                    ? "text-gray-600 font-medium text-[18px]"
                    : "text-gray-400 font-normal text-[15px]"
                }`}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => String(m).padStart(2, "0"));

function timeToIndices(timeStr: string) {
  const [hRaw, mRaw] = (timeStr || "00:00").split(":").map(Number);
  const h = Math.max(0, Math.min(23, hRaw || 0));
  const mSnap = Math.round((mRaw || 0) / 5) * 5 % 60;
  const mIdx = MINUTES.indexOf(String(mSnap).padStart(2, "0"));
  return { hIdx: h, mIdx: mIdx >= 0 ? mIdx : 0 };
}

interface ScrollTimePickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function ScrollTimePicker({ value, onChange }: ScrollTimePickerProps) {
  const { hIdx, mIdx } = timeToIndices(value);

  const onHourChange = (i: number) => {
    const curM = MINUTES[timeToIndices(value).mIdx];
    onChange(`${HOURS[i]}:${curM}`);
  };
  const onMinuteChange = (i: number) => {
    const curH = HOURS[timeToIndices(value).hIdx];
    onChange(`${curH}:${MINUTES[i]}`);
  };

  return (
    <div className="flex items-center gap-1" style={{ height: VISIBLE * ITEM_H }}>
      <ScrollColumn items={HOURS} selectedIdx={hIdx} onSelect={onHourChange} />
      <div className="text-gray-400 font-black text-2xl pb-1 flex-shrink-0">:</div>
      <ScrollColumn items={MINUTES} selectedIdx={mIdx} onSelect={onMinuteChange} />
    </div>
  );
}

function generateDates(daysBefore = 7, daysAfter = 1) {
  const today = startOfDay(new Date());
  const total = daysBefore + 1 + daysAfter;
  return Array.from({ length: total }, (_, i) => addDays(today, i - daysBefore));
}

function dateToLabel(d: Date) {
  if (isSameDay(d, startOfDay(new Date()))) return "今日";
  if (isSameDay(d, addDays(startOfDay(new Date()), -1))) return "昨日";
  return format(d, "M月d日 EEE", { locale: ja });
}

interface ScrollDateTimePickerProps {
  value: string;
  onChange: (v: string) => void;
  daysBefore?: number;
  daysAfter?: number;
}

export function ScrollDateTimePicker({ value, onChange, daysBefore = 7, daysAfter = 0 }: ScrollDateTimePickerProps) {
  const dates = generateDates(daysBefore, daysAfter);
  const dateLabels = dates.map(dateToLabel);

  const [datePart, timePart] = (value || "").split("T");
  const { hIdx, mIdx } = timeToIndices(timePart || "00:00");

  const parsedDate = datePart ? new Date(datePart + "T00:00:00") : startOfDay(new Date());
  let dateIdx = dates.findIndex(d => isSameDay(d, parsedDate));
  if (dateIdx < 0) dateIdx = dates.length - 1 - daysAfter;

  const buildValue = (dIdx: number, hI: number, mI: number) => {
    const d = dates[dIdx] ?? startOfDay(new Date());
    return `${format(d, "yyyy-MM-dd")}T${HOURS[hI]}:${MINUTES[mI]}`;
  };

  return (
    <div className="flex items-center gap-1" style={{ height: VISIBLE * ITEM_H }}>
      <ScrollColumn
        items={dateLabels}
        selectedIdx={dateIdx}
        onSelect={i => onChange(buildValue(i, hIdx, mIdx))}
        flex={2}
      />
      <div className="text-gray-300 font-bold text-lg flex-shrink-0 pb-0.5">|</div>
      <ScrollColumn
        items={HOURS}
        selectedIdx={hIdx}
        onSelect={i => onChange(buildValue(dateIdx, i, mIdx))}
      />
      <div className="text-gray-400 font-black text-2xl pb-1 flex-shrink-0">:</div>
      <ScrollColumn
        items={MINUTES}
        selectedIdx={mIdx}
        onSelect={i => onChange(buildValue(dateIdx, hIdx, i))}
      />
    </div>
  );
}
