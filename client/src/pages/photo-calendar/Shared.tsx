// 毎日の1枚カレンダー — originwebapp からの移植。第1段階ではおしらせ設定（🔔）を非表示（settings=false）。
import { type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { Baby, Bell, ChevronLeft, Grape, Camera } from "lucide-react";
import { BottomNav } from "@/components/Navigation";
import { setActiveChildIdGlobal } from "@/hooks/use-active-child";
import { PhotoError, photoUrl, type Child } from "./use-photo-calendar";
import "./photo-calendar.css";

export function PhotoTabs({ active = "photos" }: { active?: "photos" | "events" }) {
  const search = useSearch();
  const photoHref = active === "photos" && search ? `/photo-calendar?${search}` : photoUrl("/photo-calendar", Number(localStorage.getItem("activeChildId")) || undefined);
  return <nav className="photo-tabs" aria-label="カレンダーの表示"><Link href="/calendar" aria-current={active === "events" ? "page" : undefined}>予定・記録</Link><Link href={photoHref} aria-current={active === "photos" ? "page" : undefined}>写真</Link></nav>;
}
export function PhotoShell({ children, child, childrenList = [], onChild, back, settings = false }: { children: ReactNode; child?: Child; childrenList?: Child[]; onChild?: (id: number) => void; back?: string; settings?: boolean }) {
  return <main className="photo-app"><div className="photo-inner"><div className="photo-brand"><Grape size={12} className="inline mr-1" />Produced by 産前産後ケアホテル ぶどうの木</div><header className="photo-header"><div>{back ? <Link href={back} className="photo-button"><ChevronLeft size={16} />もどる</Link> : <><div className="photo-eyebrow">BABY</div><div className="flex items-center gap-2"><Baby size={24} color="#7b4f9e" /><select aria-label="赤ちゃんを切り替え" value={child?.id || ""} disabled={!childrenList.length} onChange={e => { const id = Number(e.target.value); setActiveChildIdGlobal(id); onChild?.(id); }}>{!childrenList.length && <option value="">赤ちゃん</option>}{childrenList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></>}</div>{settings && <Link className="photo-icon" href="/photo-calendar/settings" aria-label="写真のおしらせ設定"><Bell size={21} /></Link>}</header>{children}</div><BottomNav /></main>;
}
export function PhotoFailure({ error, retry }: { error: unknown; retry?: () => void }) {
  const unauthorized = error instanceof PhotoError && error.status === 401;
  return <div className="photo-error" role="alert"><p>{unauthorized ? "写真を安心して残すために、LINEでログインしてください。" : error instanceof Error ? error.message : "読み込めませんでした。"}</p>{unauthorized ? <a href="/api/auth/line" className="photo-button mt-3">LINEでログイン</a> : retry && <button className="photo-button mt-3" onClick={retry}>もう一度試す</button>}</div>;
}
export function PhotoLoading() { return <div className="photo-stack" role="status" aria-label="読み込み中"><div className="photo-skeleton" /><div className="photo-skeleton" style={{ minHeight: 80 }} /><span className="sr-only">読み込み中</span></div>; }
export function NoChildren() { return <section className="photo-card photo-empty"><Baby /><h2>赤ちゃんの登録がまだありません</h2><p className="photo-muted">プロフィールを登録すると、写真を残せます。</p><Link href="/child-profile" className="photo-button mt-4">プロフィールへ</Link></section>; }
export function EmptyPhotos() { return <div className="photo-card photo-empty"><Camera /><h2 className="font-bold mb-2">残したいときに、1枚。</h2><p className="photo-muted">何気ない日も、特別な日も。<br />写真はあとから、いつでも追加できます。</p></div>; }
