import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { useEffect } from "react";

export type Child = { id: number; name: string; birthday: string | null; canEdit: boolean };
export type Context = { children: Child[]; canNotify: boolean };
export type Photo = { id: number; photoDate: string; takenAt: string | null; source: string; imageUrl: string; thumbUrl: string };
export type Day = { date: string; photos: Photo[]; coverPhotoId: number | null; memo: string | null; isFirst: boolean; firstLabel: string | null; canEdit: boolean };
export type Month = { days: { date: string; coverPhotoId: number | null; thumbUrl: string | null; isFirst: boolean }[]; canEdit: boolean };
export class PhotoError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function photoApi<T>(url: string, method = "GET", data?: unknown, keepalive = false): Promise<T> {
  const response = await fetch(url, { method, credentials: "include", cache: "no-store", keepalive, headers: data !== undefined ? { "Content-Type": "application/json" } : undefined, body: data !== undefined ? JSON.stringify(data) : undefined });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new PhotoError(result?.message || "通信できませんでした。もう一度お試しください。", response.status);
  return result as T;
}
export const jstDate = (value = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
export const validDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00+09:00`)) && jstDate(new Date(`${value}T00:00:00+09:00`)) === value;
export const validMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function monthOffset(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00+09:00`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return jstDate(date).slice(0, 7);
}
export function photoUrl(path: string, babyId?: number, extras?: Record<string, string>) {
  const params = new URLSearchParams(extras);
  if (babyId !== undefined) params.set("baby_id", String(babyId));
  return `${path}${params.size ? `?${params}` : ""}`;
}
export function privateImage(id: number, size: "thumb" | "full") { return `/api/photos/${id}/image?size=${size}`; }
export function usePhotoContext() {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const query = useQuery<Context>({ queryKey: ["photo-context"], queryFn: () => photoApi("/api/photo-calendar/context"), retry: false, staleTime: 30_000 });
  const requested = params.get("baby_id");
  const children = query.data?.children || [];
  const child = children.find(c => String(c.id) === requested) || children.find(c => String(c.id) === localStorage.getItem("activeChildId")) || children[0];
  useEffect(() => {
    if (child && requested !== String(child.id)) {
      const next = new URLSearchParams(search); next.set("baby_id", String(child.id));
      navigate(`${location}?${next}`, { replace: true });
    }
  }, [child?.id, requested, search, location, navigate]);
  return { ...query, child, children, params, navigate, location, search };
}
export function usePhotoDay(babyId: number | undefined, date: string) {
  return useQuery<Day>({ queryKey: ["photo-day", babyId, date], queryFn: () => photoApi(`/api/photo-calendar/${babyId}/day/${date}`), enabled: babyId !== undefined && validDate(date), retry: false, staleTime: 0 });
}
export function useRefreshPhotos() {
  const client = useQueryClient();
  return () => { void client.invalidateQueries({ queryKey: ["photo-month"] }); void client.invalidateQueries({ queryKey: ["photo-day"] }); };
}
