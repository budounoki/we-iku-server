import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { photoApi, type Day } from "./use-photo-calendar";

type Draft = { memo: string; isFirst: boolean; firstLabel: string };
const draftOf = (day: Day): Draft => ({ memo: day.memo || "", isFirst: day.isFirst, firstLabel: day.firstLabel || "" });
export function useDayDraft(babyId: number | undefined, date: string, day: Day | undefined) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ memo: "", isFirst: false, firstLabel: "" });
  const [status, setStatus] = useState<"saved" | "saving" | "pending" | "error">("saved");
  const [error, setError] = useState<unknown>(null);
  const state = useRef<{ key: string; value: Draft; saved: string; editable: boolean; url: string; dirty: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Promise<void> | null>(null);
  const save = useCallback(async (): Promise<void> => {
    if (pending.current) { await pending.current; }
    const current = state.current;
    if (!current?.editable || !current.dirty) return;
    const snapshot = JSON.stringify(current.value);
    setStatus("saving");
    const task = (async () => {
      try {
        await photoApi(current.url, "PATCH", current.value);
        current.saved = snapshot;
        current.dirty = JSON.stringify(current.value) !== snapshot;
        if (!current.dirty) sessionStorage.removeItem(current.key);
        if (state.current === current) {
          setStatus(current.dirty ? "pending" : "saved"); setError(null);
          client.setQueryData<Day>(["photo-day", babyId, date], old => old ? { ...old, ...JSON.parse(snapshot) } : old);
          void client.invalidateQueries({ queryKey: ["photo-month", babyId] });
        }
      } catch (err) { if (state.current === current) { setStatus("error"); setError(err); } }
    })();
    pending.current = task;
    await task;
    if (pending.current === task) pending.current = null;
  }, [babyId, date, client]);
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    if (!day || babyId === undefined) return;
    const key = `photo-draft:${babyId}:${date}`;
    if (state.current?.key === key) return;
    const initial = draftOf(day);
    let value = initial;
    try { const stored = sessionStorage.getItem(key); if (stored && day.canEdit) value = JSON.parse(stored); } catch { /* Keep server data if draft is invalid. */ }
    state.current = { key, value, saved: JSON.stringify(initial), editable: day.canEdit, url: `/api/photo-calendar/${babyId}/day/${date}`, dirty: JSON.stringify(value) !== JSON.stringify(initial) };
    setDraft(value); setStatus(state.current.dirty ? "pending" : "saved");
    if (state.current.dirty) timer.current = setTimeout(() => void saveRef.current(), 700);
  }, [day, babyId, date]);
  useEffect(() => {
    const flush = () => {
      const current = state.current;
      if (current?.dirty && current.editable) {
        // The draft survives failed unload requests and is retried on the next visit.
        void photoApi(current.url, "PATCH", current.value, true).catch(() => {});
      }
    };
    const warn = (event: BeforeUnloadEvent) => { if (state.current?.dirty) { flush(); event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", flush);
    return () => { clearTimeout(timer.current); flush(); window.removeEventListener("beforeunload", warn); window.removeEventListener("pagehide", flush); state.current = null; };
  }, [babyId, date]);
  const update = (patch: Partial<Draft>) => {
    const current = state.current;
    if (!current?.editable) return;
    const value = { ...current.value, ...patch };
    current.value = value; current.dirty = JSON.stringify(value) !== current.saved;
    sessionStorage.setItem(current.key, JSON.stringify(value));
    setDraft(value); setStatus("pending"); setError(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveRef.current(), 850);
  };
  return { draft, update, save, status, error };
}
