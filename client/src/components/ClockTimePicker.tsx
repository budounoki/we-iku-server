import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ClockTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const CX = 110, CY = 110, NUM_R = 80, HAND_R = 70;

function toXY(index: number, r: number) {
  const a = (index * 30 - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function angleToIndex(clientX: number, clientY: number, rect: DOMRect): number | null {
  const scale = 220 / rect.width;
  const px = (clientX - rect.left) * scale;
  const py = (clientY - rect.top) * scale;
  const dx = px - CX, dy = py - CY;
  if (Math.sqrt(dx * dx + dy * dy) < 22) return null;
  const ang = ((Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360 + 360) % 360;
  return Math.round(ang / 30) % 12;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function ClockTimePicker({ value, onChange }: ClockTimePickerProps) {
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const parts = (value || "12:00").split(":");
  const hh = Math.min(23, Math.max(0, parseInt(parts[0]) || 0));
  const rawMm = Math.min(59, Math.max(0, parseInt(parts[1]) || 0));
  const mm = Math.round(rawMm / 5) * 5 % 60;

  const isAM = hh < 12;
  const dispH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const selIdx = mode === "hour" ? (dispH % 12) : (mm / 5);
  const handPt = toXY(selIdx, HAND_R);

  const fromEvent = (e: { clientX: number; clientY: number }): number | null => {
    if (!svgRef.current) return null;
    return angleToIndex(e.clientX, e.clientY, svgRef.current.getBoundingClientRect());
  };

  const apply = (idx: number, finalize: boolean) => {
    if (mode === "hour") {
      const label = HOURS[idx];
      const h24 = isAM ? (label === 12 ? 0 : label) : (label === 12 ? 12 : label + 12);
      onChange(`${String(h24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      if (finalize) setTimeout(() => setMode("minute"), 120);
    } else {
      const m = MINUTES[idx];
      onChange(`${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  };

  const toggleAMPM = (toAM: boolean) => {
    if (toAM === isAM) return;
    const newH = toAM ? hh - 12 : hh + 12;
    if (newH >= 0 && newH <= 23) {
      onChange(`${String(newH).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
  };

  const labels = mode === "hour" ? HOURS : MINUTES;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          data-testid="clock-hour-display"
          onClick={() => setMode("hour")}
          className={cn(
            "text-2xl font-black px-3 py-1.5 rounded-xl transition-colors",
            mode === "hour" ? "bg-purple-100 text-purple-700" : "text-gray-400 bg-gray-50"
          )}
        >
          {String(dispH).padStart(2, "0")}
        </button>
        <span className="text-2xl font-black text-gray-300">:</span>
        <button
          data-testid="clock-minute-display"
          onClick={() => setMode("minute")}
          className={cn(
            "text-2xl font-black px-3 py-1.5 rounded-xl transition-colors",
            mode === "minute" ? "bg-purple-100 text-purple-700" : "text-gray-400 bg-gray-50"
          )}
        >
          {String(mm).padStart(2, "0")}
        </button>
        <div className="flex flex-col gap-1 ml-3">
          {([true, false] as const).map((a) => (
            <button
              key={String(a)}
              data-testid={a ? "clock-btn-am" : "clock-btn-pm"}
              onClick={() => toggleAMPM(a)}
              className={cn(
                "text-xs font-black px-2.5 py-1 rounded-xl transition-colors",
                a === isAM ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-400"
              )}
            >
              {a ? "午前" : "午後"}
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 220 220"
        data-testid="clock-face"
        className="w-full max-w-[220px] touch-none select-none cursor-pointer"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          const idx = fromEvent(e);
          if (idx !== null) apply(idx, false);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const idx = fromEvent(e);
          if (idx !== null) apply(idx, false);
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          const idx = fromEvent(e);
          if (idx !== null) apply(idx, true);
        }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <circle cx={CX} cy={CY} r={105} fill="#F8F4FC" stroke="#E5D8F0" strokeWidth={2} />

        {Array.from({ length: 60 }, (_, i) => {
          const a = (i * 6 - 90) * Math.PI / 180;
          const isMajor = i % 5 === 0;
          const r1 = isMajor ? 90 : 97;
          return (
            <line
              key={i}
              x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
              x2={CX + 103 * Math.cos(a)} y2={CY + 103 * Math.sin(a)}
              stroke={isMajor ? "#C4A8E0" : "#EDE5F5"}
              strokeWidth={isMajor ? 2.5 : 1}
            />
          );
        })}

        <line
          x1={CX} y1={CY}
          x2={handPt.x} y2={handPt.y}
          stroke="#805AAA"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={handPt.x} cy={handPt.y} r={13} fill="#805AAA" opacity={0.18} />
        <circle cx={CX} cy={CY} r={5} fill="#805AAA" />

        {labels.map((label, i) => {
          const pos = toXY(i, NUM_R);
          const isSelected = i === selIdx;
          return (
            <g key={`${mode}-${i}`}>
              {isSelected && <circle cx={pos.x} cy={pos.y} r={17} fill="#805AAA" />}
              <text
                x={pos.x} y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={mode === "minute" ? "11" : "13"}
                fontWeight={isSelected ? "bold" : "500"}
                fill={isSelected ? "white" : "#5A3D7B"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {mode === "minute" ? String(label).padStart(2, "0") : label}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-[11px] text-gray-400 font-medium">
        {mode === "hour" ? "「時」をドラッグまたはタップ → 「分」へ" : "「分」をドラッグまたはタップ"}
      </p>
    </div>
  );
}

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function DateTimeClock({ value, onChange }: DateTimePickerProps) {
  const [datePart, timePart] = value.includes("T")
    ? value.split("T")
    : [value, "12:00"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 shrink-0">日付</span>
        <input
          type="date"
          value={datePart}
          onChange={(e) => onChange(`${e.target.value}T${timePart}`)}
          data-testid="input-log-date"
          className="rounded-xl border border-gray-200 text-sm h-9 font-medium text-gray-600 px-2 flex-1 bg-white"
        />
      </div>
      <ClockTimePicker
        value={timePart}
        onChange={(t) => onChange(`${datePart}T${t}`)}
      />
    </div>
  );
}

// ─── 24時間表示クロックピッカー ───────────────────────────────────────────────

const OUTER_R = 80;
const INNER_R = 47;
const OUTER_HAND_R = 70;
const INNER_HAND_R = 37;
const INNER_BOUNDARY = 63;

const HOURS_OUTER_24 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOURS_INNER_24 = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const MINUTES_24 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function toXY24(index: number, r: number) {
  const a = (index * 30 - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function fromEvent24(e: { clientX: number; clientY: number }, svgEl: SVGSVGElement): { idx: number; isInner: boolean } | null {
  const rect = svgEl.getBoundingClientRect();
  const scale = 220 / rect.width;
  const px = (e.clientX - rect.left) * scale;
  const py = (e.clientY - rect.top) * scale;
  const dx = px - CX, dy = py - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 20) return null;
  const ang = ((Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360 + 360) % 360;
  const idx = Math.round(ang / 30) % 12;
  return { idx, isInner: dist < INNER_BOUNDARY };
}

export function Clock24TimePicker({ value, onChange }: ClockTimePickerProps) {
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const parts = (value || "00:00").split(":");
  const hh = Math.min(23, Math.max(0, parseInt(parts[0]) || 0));
  const rawMm = Math.min(59, Math.max(0, parseInt(parts[1]) || 0));
  const mm = Math.round(rawMm / 5) * 5 % 60;

  const isOuter = hh < 12;
  const hourIdx = isOuter ? hh : hh - 12;
  const minIdx = mm / 5;

  const handR = mode === "hour" ? (isOuter ? OUTER_HAND_R : INNER_HAND_R) : OUTER_HAND_R;
  const handIdx = mode === "hour" ? hourIdx : minIdx;
  const handPt = toXY24(handIdx, handR);

  const apply24 = (idx: number, isInner: boolean, finalize: boolean) => {
    if (mode === "hour") {
      const h = isInner ? idx + 12 : idx;
      onChange(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      if (finalize) setTimeout(() => setMode("minute"), 120);
    } else {
      const m = MINUTES_24[idx];
      onChange(`${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  };

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>, finalize: boolean) => {
    if (!svgRef.current) return;
    if (mode === "minute") {
      const idx = angleToIndex(e.clientX, e.clientY, svgRef.current.getBoundingClientRect());
      if (idx !== null) apply24(idx, false, finalize);
    } else {
      const res = fromEvent24(e, svgRef.current);
      if (res) apply24(res.idx, res.isInner, finalize);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          data-testid="clock24-hour-display"
          onClick={() => setMode("hour")}
          className={cn(
            "text-2xl font-black px-3 py-1.5 rounded-xl transition-colors",
            mode === "hour" ? "bg-purple-100 text-purple-700" : "text-gray-400 bg-gray-50"
          )}
        >
          {String(hh).padStart(2, "0")}
        </button>
        <span className="text-2xl font-black text-gray-300">:</span>
        <button
          data-testid="clock24-minute-display"
          onClick={() => setMode("minute")}
          className={cn(
            "text-2xl font-black px-3 py-1.5 rounded-xl transition-colors",
            mode === "minute" ? "bg-purple-100 text-purple-700" : "text-gray-400 bg-gray-50"
          )}
        >
          {String(mm).padStart(2, "0")}
        </button>
        <span className="ml-3 text-xs font-black text-purple-400 bg-purple-50 px-2 py-1 rounded-lg">24h</span>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 220 220"
        data-testid="clock24-face"
        className="w-full max-w-[220px] touch-none select-none cursor-pointer"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          handlePointer(e, false);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          handlePointer(e, false);
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          handlePointer(e, true);
        }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <circle cx={CX} cy={CY} r={105} fill="#F8F4FC" stroke="#E5D8F0" strokeWidth={2} />

        {Array.from({ length: 60 }, (_, i) => {
          const a = (i * 6 - 90) * Math.PI / 180;
          const isMajor = i % 5 === 0;
          const r1 = isMajor ? 90 : 97;
          return (
            <line
              key={i}
              x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
              x2={CX + 103 * Math.cos(a)} y2={CY + 103 * Math.sin(a)}
              stroke={isMajor ? "#C4A8E0" : "#EDE5F5"}
              strokeWidth={isMajor ? 2.5 : 1}
            />
          );
        })}

        {mode === "hour" && (
          <>
            {HOURS_OUTER_24.map((label, i) => {
              const pos = toXY24(i, OUTER_R);
              const isSelected = isOuter && i === hourIdx;
              return (
                <g key={`outer-${i}`}>
                  {isSelected && <circle cx={pos.x} cy={pos.y} r={17} fill="#805AAA" />}
                  <text
                    x={pos.x} y={pos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize="13" fontWeight={isSelected ? "bold" : "500"}
                    fill={isSelected ? "white" : "#5A3D7B"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {String(label).padStart(2, "0")}
                  </text>
                </g>
              );
            })}
            {HOURS_INNER_24.map((label, i) => {
              const pos = toXY24(i, INNER_R);
              const isSelected = !isOuter && i === hourIdx;
              return (
                <g key={`inner-${i}`}>
                  {isSelected && <circle cx={pos.x} cy={pos.y} r={13} fill="#805AAA" />}
                  <text
                    x={pos.x} y={pos.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize="10" fontWeight={isSelected ? "bold" : "400"}
                    fill={isSelected ? "white" : "#9B7EC8"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {String(label).padStart(2, "0")}
                  </text>
                </g>
              );
            })}
          </>
        )}

        {mode === "minute" && MINUTES_24.map((label, i) => {
          const pos = toXY24(i, OUTER_R);
          const isSelected = i === minIdx;
          return (
            <g key={`min-${i}`}>
              {isSelected && <circle cx={pos.x} cy={pos.y} r={17} fill="#805AAA" />}
              <text
                x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize="11" fontWeight={isSelected ? "bold" : "500"}
                fill={isSelected ? "white" : "#5A3D7B"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {String(label).padStart(2, "0")}
              </text>
            </g>
          );
        })}

        <line
          x1={CX} y1={CY}
          x2={handPt.x} y2={handPt.y}
          stroke="#805AAA" strokeWidth={3} strokeLinecap="round"
        />
        <circle cx={handPt.x} cy={handPt.y} r={mode === "hour" && !isOuter ? 10 : 13} fill="#805AAA" opacity={0.18} />
        <circle cx={CX} cy={CY} r={5} fill="#805AAA" />
      </svg>

      <p className="text-[11px] text-gray-400 font-medium">
        {mode === "hour"
          ? "外側: 0〜11時 / 内側: 12〜23時 → 「分」へ"
          : "「分」をドラッグまたはタップ"}
      </p>
    </div>
  );
}

export function DateTimeClock24({ value, onChange }: DateTimePickerProps) {
  const [datePart, timePart] = value.includes("T")
    ? value.split("T")
    : [value, "00:00"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 shrink-0">日付</span>
        <input
          type="date"
          value={datePart}
          onChange={(e) => onChange(`${e.target.value}T${timePart}`)}
          data-testid="input-log-date"
          className="rounded-xl border border-gray-200 text-sm h-9 font-medium text-gray-600 px-2 flex-1 bg-white"
        />
      </div>
      <Clock24TimePicker
        value={timePart}
        onChange={(t) => onChange(`${datePart}T${t}`)}
      />
    </div>
  );
}
