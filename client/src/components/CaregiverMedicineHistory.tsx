import { useId, useState } from "react";
import { ChevronDown, Pill, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

type MedicineLog = {
  id: number;
  createdAt: string | Date;
  medicineName?: string | null;
  medicineDose?: string | null;
  message?: string | null;
};

type CaregiverMedicineHistoryProps = {
  logs: MedicineLog[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

function medicineMemo(log: MedicineLog): string {
  const message = log.message ?? "";
  // Match the writer's exact composition, not individual words or a loose
  // regex. Removing just the join separator preserves the note's whitespace.
  const parts = [log.medicineName, log.medicineDose].filter(Boolean);
  const prefix = `服薬: ${parts.join(" ")}`;
  if (message === prefix) return "";
  if (parts.length === 0) {
    return message.startsWith(prefix) ? message.slice(prefix.length) : message;
  }
  const prefixWithSeparator = `${prefix} `;
  return message.startsWith(prefixWithSeparator)
    ? message.slice(prefixWithSeparator.length)
    : message;
}

function recordedDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return { label: format(date, "yyyy/MM/dd HH:mm"), iso: date.toISOString() };
}

export function CaregiverMedicineHistory({
  logs,
  isLoading,
  isError,
  onRetry,
}: CaregiverMedicineHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const panelId = `${id}-medicine-history`;
  const controlId = `${id}-medicine-history-control`;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/50">
      <button
        type="button"
        id={controlId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold text-violet-700 hover:bg-violet-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
        data-testid="button-caregiver-medicine-history-toggle"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Pill className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>お薬の履歴を見る</span>
          {!isLoading && !isError && (
            <span className="shrink-0 text-[11px] font-medium text-violet-600">
              ({logs.length}件)
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={controlId}
        aria-busy={isLoading}
        hidden={!expanded}
        className="border-t border-violet-100"
      >
        {isLoading ? (
          <div role="status" className="space-y-4 p-4">
            <span className="sr-only">お薬の履歴を読み込んでいます</span>
            {[0, 1, 2].map((index) => (
              <div key={index} aria-hidden="true" className="space-y-2 animate-pulse motion-reduce:animate-none">
                <div className="h-3 w-32 rounded bg-violet-100" />
                <div className="h-4 w-2/3 rounded bg-violet-100" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-3 px-4 py-5">
            <p role="alert" className="text-xs leading-relaxed text-violet-800">
              お薬の履歴を読み込めませんでした。もう一度お試しください。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="min-h-11 rounded-xl border-violet-200 text-violet-700"
              data-testid="button-caregiver-medicine-history-retry"
            >
              <RotateCcw aria-hidden="true" />
              もう一度読み込む
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div role="status" className="px-4 py-6 text-center">
            <Pill aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-violet-400" />
            <p className="text-xs font-bold text-violet-800">お薬の記録はまだありません</p>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-600">
              記録したお薬を、ここで振り返れます。
            </p>
          </div>
        ) : (
          <div
            tabIndex={0}
            aria-label="お薬の履歴一覧"
            className="max-h-[50vh] overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
          >
            {/* The parent supplies the complete list in newest-first order. */}
            <ol className="divide-y divide-violet-100">
              {logs.map((log) => {
                const date = recordedDate(log.createdAt);
                const memo = medicineMemo(log);
                return (
                  <li
                    key={log.id}
                    className="min-w-0 px-4 py-3"
                    data-testid={`caregiver-medicine-history-${log.id}`}
                  >
                    <div className="mb-1.5 text-[11px] font-medium tabular-nums text-violet-600">
                      {date ? (
                        <time dateTime={date.iso}>{date.label}</time>
                      ) : (
                        <span>日時不明</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-violet-900 [overflow-wrap:anywhere]">
                      {log.medicineName || "お薬の名前未記入"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-violet-700 [overflow-wrap:anywhere]">
                      <span className="font-medium">服用量：</span>
                      {log.medicineDose || "未記入"}
                    </p>
                    {memo !== "" && (
                      <div className="mt-2 rounded-xl bg-violet-100/50 px-3 py-2">
                        <p className="mb-0.5 text-[10px] font-bold text-violet-600">メモ</p>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-violet-800 [overflow-wrap:anywhere]">
                          {memo}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
