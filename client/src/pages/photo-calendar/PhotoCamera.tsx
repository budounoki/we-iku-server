import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Camera, ImagePlus, Check, X } from "lucide-react";
import { preparePhoto, type PreparedPhoto } from "@/lib/photo-image";
import { NoChildren, PhotoFailure, PhotoLoading, PhotoShell } from "./Shared";
import { jstDate, PhotoError, photoApi, photoUrl, usePhotoContext, useRefreshPhotos, validDate } from "./use-photo-calendar";

type Item = { key: string; requestId: string; file: File; source: "camera" | "library"; prepared?: PreparedPhoto; photoDate: string; attempted?: boolean; status: "ready" | "processing" | "uploading" | "saved" | "error"; progress: number; error?: unknown };
function upload(babyId: number, item: Item, onProgress: (progress: number) => void): Promise<{ id: number; photoDate: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/photo-calendar/${babyId}/photos`);
    xhr.withCredentials = true; xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 120000;
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => reject(new Error("通信できませんでした。写真を残したまま再試行できます。"));
    xhr.ontimeout = () => reject(new Error("通信に時間がかかっています。同じ写真を再試行できます。"));
    xhr.onabort = () => reject(new Error("アップロードが中断されました。もう一度お試しください。"));
    xhr.onload = () => {
      let body: any;
      try { body = JSON.parse(xhr.responseText); } catch { body = null; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new PhotoError(body?.message || "写真を保存できませんでした。", xhr.status));
    };
    xhr.send(JSON.stringify({ requestId: item.requestId, photoDate: item.photoDate, source: item.source, takenAt: item.prepared!.takenAt, fullBase64: item.prepared!.fullBase64, thumbBase64: item.prepared!.thumbBase64 }));
  });
}

export default function PhotoCamera() {
  const context = usePhotoContext(), { child, params } = context;
  const today = jstDate(), selected = params.get("date");
  const explicitDate = validDate(selected) ? selected : null;
  const cameraInput = useRef<HTMLInputElement>(null), libraryInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]), [working, setWorking] = useState(false), [noticeError, setNoticeError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const refresh = useRefreshPhotos();
  const lock = useRef(false);
  const acknowledged = useRef<string | null>(null);
  const nid = params.get("nid");
  const recordOpened = async () => {
    if (!nid) return;
    try { await photoApi(`/api/photo-notifications/${encodeURIComponent(nid)}/opened`, "POST", {}); setNoticeError(null); } catch (err) { setNoticeError(err); }
  };
  useEffect(() => { if (nid && acknowledged.current !== nid) { acknowledged.current = nid; void recordOpened(); } }, [nid]);
  const dirty = items.some(i => i.status !== "saved");
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const patch = (key: string, change: Partial<Item>) => setItems(old => old.map(i => i.key === key ? { ...i, ...change } : i));
  const prepare = async (item: Item) => {
    patch(item.key, { status: "processing", error: undefined });
    try {
      const prepared = await preparePhoto(item.file, item.source === "camera");
      const captureDay = prepared.takenAt ? jstDate(new Date(prepared.takenAt)) : null;
      let photoDate = explicitDate || (item.source === "library" && captureDay ? captureDay : today);
      if (item.source === "library" && explicitDate && captureDay && captureDay !== explicitDate) {
        const useCaptureDate = window.confirm(`${item.file.name}\n${captureDay}の写真のようです。その日に入れますか？\n「OK」：撮影日に入れる\n「キャンセル」：選んだ${explicitDate}に入れる`);
        if (useCaptureDate) photoDate = captureDay;
      }
      patch(item.key, { prepared, photoDate, status: "ready", error: undefined });
    } catch (error) { patch(item.key, { status: "error", error: error instanceof Error ? error : new Error("画像を変換できませんでした。JPEGなど別の形式をお試しください。") }); }
  };
  const select = async (files: FileList | null, source: "camera" | "library") => {
    if (!files?.length || lock.current) return;
    lock.current = true; setWorking(true); setMessage("");
    const next: Item[] = Array.from(files).map(file => ({ key: crypto.randomUUID(), requestId: crypto.randomUUID(), file, source, photoDate: explicitDate || today, status: "processing", progress: 0 }));
    if (source === "camera") setItems(old => [...old.filter(i => i.source !== "camera" || i.status === "saved"), ...next]);
    else setItems(old => [...old, ...next]);
    try { for (const item of next) await prepare(item); } finally { lock.current = false; setWorking(false); }
  };
  const save = async () => {
    if (!child || lock.current) return;
    lock.current = true; setWorking(true); setMessage("");
    let success = 0, failed = 0;
    try {
      for (const item of items.filter(i => i.status !== "saved")) {
        if (!item.prepared) { failed++; continue; }
        patch(item.key, { status: "uploading", attempted: true, progress: 0, error: undefined });
        try {
          await upload(child.id, item, progress => patch(item.key, { progress }));
          patch(item.key, { status: "saved", progress: 100 }); success++;
        } catch (error) { patch(item.key, { status: "error", error }); failed++; }
      }
      if (success) { refresh(); setMessage(failed ? `${success}枚を残しました。保存できなかった写真は再試行できます。` : "今日の1枚が残りました！"); }
    } finally { lock.current = false; setWorking(false); }
  };
  const completed = items.length > 0 && items.every(i => i.status === "saved");
  const back = photoUrl("/photo-calendar", child?.id, { month: (explicitDate || today).slice(0, 7) });
  return <PhotoShell back={back}>
    <div className="photo-eyebrow">{child?.name}の、いま。</div><h1 className="photo-title">1枚、残しておこう</h1><p className="photo-muted">{explicitDate ? `${explicitDate}の写真を追加します。` : "何枚でも、あとからでも大丈夫。"}</p>
    {context.isLoading ? <PhotoLoading /> : context.error ? <PhotoFailure error={context.error} retry={() => void context.refetch()} /> : !child ? <NoChildren /> : selected && !explicitDate ? <PhotoFailure error={new Error("日付が正しくありません。カレンダーから選び直してください。")} /> : <>
      {!!noticeError && <PhotoFailure error={noticeError} retry={() => void recordOpened()} />}
      <input ref={cameraInput} hidden tabIndex={-1} aria-hidden="true" type="file" accept="image/*" capture="environment" onChange={e => { void select(e.target.files, "camera"); e.currentTarget.value = ""; }} />
      <input ref={libraryInput} hidden tabIndex={-1} aria-hidden="true" type="file" accept="image/*,.heic,.heif" multiple onChange={e => { void select(e.target.files, "library"); e.currentTarget.value = ""; }} />
      <div className="photo-card photo-stack"><button className="photo-button primary" disabled={working} onClick={() => cameraInput.current?.click()}><Camera size={19} />{items.some(i => i.source === "camera" && i.status !== "saved") ? "撮り直す" : "撮影する"}</button><button className="photo-button" disabled={working} onClick={() => libraryInput.current?.click()}><ImagePlus size={19} />カメラロールから選ぶ</button><p className="photo-muted">複数の写真をまとめて追加できます。<br />カメラや写真を開けない場合は、端末・ブラウザの設定でアクセスを許可してください。</p></div>
      <div className="photo-stack mt-5">{items.map((item, index) => <article className="photo-card" key={item.key} style={{ marginTop: 0 }}>
        <div className="photo-row"><h2 className="text-sm font-bold">{index + 1}枚目{item.status === "saved" ? "・保存しました" : ""}</h2>{item.status !== "saved" && <button className="photo-icon" aria-label={`${index + 1}枚目を取り除く`} disabled={working} onClick={() => setItems(old => old.filter(i => i.key !== item.key))}><X size={18} /></button>}</div>
        {item.prepared ? <img className="photo-preview" src={item.prepared.preview} alt={`${index + 1}枚目のプレビュー`} /> : item.status === "processing" ? <div className="photo-skeleton my-4" role="status" aria-label="画像を準備中" /> : <p className="photo-muted my-4">画像をまだ表示できません。元の写真は再試行のため保持しています。</p>}
        <label className="photo-stack">カレンダーに残す日<input type="date" value={item.photoDate} disabled={working || item.status === "saved" || item.attempted} min={child.birthday?.slice(0, 10)} onChange={e => { if (validDate(e.target.value)) patch(item.key, { photoDate: e.target.value }); }} /></label>
        {item.status === "uploading" && <div role="status" className="mt-3"><progress value={item.progress} max={100} /><p className="photo-muted">{item.progress === 100 ? "サーバーに保存しています…" : `送信中 ${item.progress}%`}</p></div>}
        {!!item.error && <PhotoFailure error={item.error} retry={item.prepared ? () => void save() : () => { if (!lock.current) { lock.current = true; setWorking(true); void prepare(item).finally(() => { lock.current = false; setWorking(false); }); } }} />}
      </article>)}</div>
      {message && <div className="photo-card photo-row" role="status"><Check size={22} color="#7b4f9e" /><p className="text-sm font-bold">{message}</p></div>}
      <div className="photo-stack mt-5">{!completed && items.some(i => i.prepared && i.status !== "saved") && <button className="photo-button primary" disabled={working} onClick={() => void save()}>{working ? "写真を残しています…" : items.some(i => i.status === "error") ? "もう一度、残す" : "この写真を残す"}</button>}{completed && <Link href={back} className="photo-button primary">カレンダーに戻る</Link>}</div>
    </>}
  </PhotoShell>;
}
