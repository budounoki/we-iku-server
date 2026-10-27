import { useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyPhotos, NoChildren, PhotoFailure, PhotoLoading, PhotoShell, PhotoTabs } from "./Shared";
import { jstDate, monthOffset, photoApi, photoUrl, privateImage, usePhotoContext, validMonth, type Month } from "./use-photo-calendar";

export default function PhotoCalendar() {
  const context = usePhotoContext();
  const { child, params, navigate } = context;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const today = jstDate();
  const requested = params.get("month");
  const floor = child?.birthday?.slice(0, 7);
  const selected = validMonth(requested) ? requested : today.slice(0, 7);
  const month = floor && selected < floor ? floor : selected;
  const query = useQuery<Month>({ queryKey: ["photo-month", child?.id, month], queryFn: () => photoApi(`/api/photo-calendar/${child!.id}?month=${month}`), enabled: !!child, staleTime: 0, retry: false });
  const move = (delta: number) => {
    const next = monthOffset(month, delta);
    if (floor && next < floor) return;
    const nextParams = new URLSearchParams(context.search);
    nextParams.set("month", next);
    navigate(`/photo-calendar?${nextParams}`);
  };
  const daysCount = new Date(`${monthOffset(month, 1)}-01T00:00:00+09:00`).getTime() - new Date(`${month}-01T00:00:00+09:00`).getTime();
  const offset = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const byDate = new Map(query.data?.days.map(day => [day.date, day]));
  const changeChild = (id: number) => { const next = new URLSearchParams(context.search); next.set("baby_id", String(id)); navigate(`/photo-calendar?${next}`); };
  return <PhotoShell child={child} childrenList={context.children} onChild={changeChild}>
    <PhotoTabs /><div className="photo-eyebrow">日々を、少しずつ。</div><h1 className="photo-title">毎日の1枚カレンダー</h1><p className="photo-muted">撮れた日も、撮らない日も。あなたのペースで。</p>
    {context.isLoading ? <PhotoLoading /> : context.error ? <PhotoFailure error={context.error} retry={() => void context.refetch()} /> : !child ? <NoChildren /> : <>
      <section className="photo-card" aria-label={`${month}の写真カレンダー`} style={{ padding: "18px 12px" }}>
        <div className="photo-row"><button className="photo-icon" aria-label="前の月" disabled={!!floor && month <= floor} onClick={() => move(-1)}><ChevronLeft /></button><h2 className="photo-month">{Number(month.slice(0, 4))}年 {Number(month.slice(5))}月</h2><button className="photo-icon" aria-label="次の月" onClick={() => move(1)}><ChevronRight /></button></div>
        {query.isLoading ? <PhotoLoading /> : query.error ? <PhotoFailure error={query.error} retry={() => void query.refetch()} /> : <div className="photo-grid" onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={e => { const start = touch.current; touch.current = null; if (!start) return; const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1); }}>
          {["日", "月", "火", "水", "木", "金", "土"].map(day => <div className="photo-weekday" key={day}>{day}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={`pad${i}`} />)}
          {Array.from({ length: Math.round(daysCount / 86400000) }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`, day = byDate.get(date), isToday = date === today;
            const beforeBirthday = !!child.birthday && date < child.birthday.slice(0, 10);
            const classes = `photo-cell${day?.coverPhotoId ? " has-photo" : ""}${isToday ? " today" : ""}`;
            if (beforeBirthday) return <div className={classes} key={date} style={{ background: "transparent", opacity: .4 }}><span>{i + 1}</span></div>;
            return <Link key={date} className={classes} aria-label={`${Number(month.slice(5))}月${i + 1}日${isToday ? "、今日の写真を撮る" : "の写真"}${day?.isFirst ? "、はじめて" : ""}`} href={photoUrl(isToday ? "/photo-calendar/camera" : `/photo-calendar/day/${date}`, child.id)}>
              {day?.coverPhotoId && <img src={privateImage(day.coverPhotoId, "thumb")} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />}
              <span>{i + 1}</span>{day?.isFirst && <i className="photo-first" aria-hidden="true" />}{isToday && <Camera className="today-camera" />}
            </Link>;
          })}
        </div>}
        <div className="photo-row mt-4"><span className="photo-muted"><i className="inline-block rounded-full w-1.5 h-1.5 mr-1.5" style={{ background: "#ff8e7f" }} />はじめての記念日</span><button className="photo-button" onClick={() => { const next = new URLSearchParams(context.search); next.set("month", today.slice(0, 7)); navigate(`/photo-calendar?${next}`); }}>今月へ</button></div>
      </section>
      {!query.isLoading && !query.error && !query.data?.days.some(d => d.coverPhotoId) && <EmptyPhotos />}
      <div className="photo-stack mt-5"><Link className="photo-button primary" href={photoUrl("/photo-calendar/camera", child.id)}><Camera size={18} />今日の1枚を残す</Link><Link className="photo-button" href={photoUrl(`/photo-calendar/day/${today}`, child.id)}>今日の写真を見る</Link></div>
    </>}
  </PhotoShell>;
}
