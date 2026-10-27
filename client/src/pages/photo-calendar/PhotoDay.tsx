import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Camera, ImagePlus, Star, Trash2, X } from "lucide-react";
import { EmptyPhotos, NoChildren, PhotoFailure, PhotoLoading, PhotoShell } from "./Shared";
import { photoApi, photoUrl, privateImage, usePhotoContext, usePhotoDay, useRefreshPhotos, validDate, type Photo } from "./use-photo-calendar";
import { useDayDraft } from "./use-day-draft";

export default function PhotoDay() {
  const { date = "" } = useParams<{ date: string }>();
  const context = usePhotoContext(), { child } = context;
  const query = usePhotoDay(child?.id, date);
  const editor = useDayDraft(child?.id, date, query.data);
  const refresh = useRefreshPhotos();
  const [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  const [enlarged, setEnlarged] = useState<Photo | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastAction = useRef<(() => Promise<unknown>) | null>(null);
  useEffect(() => { if (enlarged) dialog.current?.showModal(); else dialog.current?.close(); }, [enlarged]);
  const mutate = async (action: () => Promise<unknown>) => {
    lastAction.current = action;
    setBusy(true); setError(null);
    try { await action(); refresh(); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const editable = !!child?.canEdit && !!query.data?.canEdit;
  const back = photoUrl("/photo-calendar", child?.id, { month: date.slice(0, 7) });
  return <PhotoShell back={back}>
    <div className="photo-eyebrow">{child?.name}のアルバム</div><h1 className="photo-title">{validDate(date) ? `${Number(date.slice(0, 4))}年${Number(date.slice(5, 7))}月${Number(date.slice(8))}日` : "日付を確認してください"}</h1>
    {!validDate(date) ? <PhotoFailure error={new Error("正しい日付のカレンダーから開いてください。")} /> : context.isLoading || query.isLoading ? <PhotoLoading /> : context.error ? <PhotoFailure error={context.error} retry={() => void context.refetch()} /> : !child ? <NoChildren /> : query.error ? <PhotoFailure error={query.error} retry={() => void query.refetch()} /> : query.data && <>
      {!!error && <PhotoFailure error={error} retry={() => { if (!busy && lastAction.current) void mutate(lastAction.current); }} />}
      {!query.data.photos.length ? <EmptyPhotos /> : <div className="photo-album">{query.data.photos.map(photo => <article className="photo-tile" key={photo.id}>
        <button className="block w-full" aria-label="写真を拡大" onClick={() => setEnlarged(photo)}><img src={privateImage(photo.id, "thumb")} alt={`${date}の写真`} loading="lazy" /></button>
        <div className="photo-row">{editable ? <button className="photo-button" disabled={busy || query.data.coverPhotoId === photo.id} onClick={() => void mutate(() => photoApi(`/api/photo-calendar/${child.id}/day/${date}`, "PATCH", { coverPhotoId: photo.id }))}><Star size={14} fill={query.data.coverPhotoId === photo.id ? "currentColor" : "none"} />{query.data.coverPhotoId === photo.id ? "今日の1枚" : "表紙にする"}</button> : <span className="photo-muted px-2">{query.data.coverPhotoId === photo.id ? "今日の1枚" : "写真"}</span>}
          {editable && <button className="photo-icon" aria-label="この写真を削除" disabled={busy} onClick={() => { if (window.confirm("この写真を削除しますか？この操作は取り消せません。")) void mutate(() => photoApi(`/api/photos/${photo.id}`, "DELETE")); }}><Trash2 size={16} /></button>}</div>
      </article>)}</div>}
      <section className="photo-card photo-stack"><label htmlFor="photo-memo">この日のひとこと</label><textarea id="photo-memo" rows={3} maxLength={2000} value={editor.draft.memo} disabled={!editable} placeholder={editable ? "笑ったこと、気づいたこと。ひとことでも。" : "この日のメモ"} onChange={e => editor.update({ memo: e.target.value })} />
        <label className="photo-row"><span className="flex items-center gap-2"><Star size={17} color="#ff8e7f" />はじめての記念日</span><input type="checkbox" checked={editor.draft.isFirst} disabled={!editable} onChange={e => editor.update({ isFirst: e.target.checked })} /></label>
        {editor.draft.isFirst && <label className="photo-stack">はじめての内容<input value={editor.draft.firstLabel} maxLength={100} disabled={!editable} placeholder="例：寝返り" onChange={e => editor.update({ firstLabel: e.target.value })} /></label>}
        {editable ? <p className="photo-muted" role="status">{editor.status === "saved" ? "自動保存しました" : editor.status === "saving" ? "保存しています…" : editor.status === "error" ? "まだ保存できていません。入力はこの端末に残っています。" : "変更を保存します…"}</p> : <p className="photo-muted">メモ・記念日・今日の1枚は、保護者が編集できます。</p>}
        {!!editor.error && <PhotoFailure error={editor.error} retry={() => void editor.save()} />}
      </section>
      <div className="photo-stack mt-5"><Link href={photoUrl("/photo-calendar/camera", child.id, { date })} className="photo-button primary"><Camera size={18} />撮影する</Link><Link href={photoUrl("/photo-calendar/camera", child.id, { date, source: "library" })} className="photo-button"><ImagePlus size={18} />カメラロールから選ぶ</Link></div>
    </>}
    <dialog ref={dialog} className="photo-dialog" onCancel={() => setEnlarged(null)} onClose={() => setEnlarged(null)} onClick={e => { if (e.target === e.currentTarget) setEnlarged(null); }}><div className="photo-row mb-2"><span className="photo-muted">{date}</span><button autoFocus className="photo-icon" aria-label="拡大写真を閉じる" onClick={() => setEnlarged(null)}><X /></button></div>{enlarged && <img src={privateImage(enlarged.id, "full")} alt={`${date}の写真（拡大）`} />}</dialog>
  </PhotoShell>;
}
