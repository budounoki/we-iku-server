import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SupporterChild,
  SupporterInvitation,
  SupporterStatus,
  fromJstInput,
  jstDateTime,
  supporterFetch,
  supporterInvitationState,
  toJstInput,
} from "@/lib/supporter";
import { SupporterStatusPanel } from "@/components/supporter/SupporterStatus";

type Invitation = SupporterInvitation & { childId: number; recipientAddress: string; displayName: string };
type ManageResponse = { children: Omit<SupporterChild, "grants">[]; invitations: Invitation[] };

function nowJstInput() {
  return toJstInput(new Date().toISOString());
}

export default function SupporterManage() {
  const [status, setStatus] = useState<SupporterStatus>();
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [data, setData] = useState<ManageResponse>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ childId: "", recipientCode: "", startsAt: nowJstInput(), endsAt: "" });
  const [extend, setExtend] = useState<number>();
  const [extendEnd, setExtendEnd] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    try { setData(await supporterFetch<ManageResponse>("/api/supporter/manage")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "管理情報を取得できません。"); }
  };
  useEffect(() => {
    supporterFetch<SupporterStatus>("/api/supporter/status")
      .then(setStatus).catch((caught) => setStatusError(caught instanceof Error ? caught.message : "利用状態を確認できません。"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (status?.enabled && status.authenticated && status.canManage) load(); }, [status?.enabled, status?.authenticated, status?.canManage]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.childId || !form.recipientCode.trim() || !form.startsAt || !form.endsAt) return;
    const startsAt = fromJstInput(form.startsAt);
    const endsAt = fromJstInput(form.endsAt);
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      setError("終了日時は開始日時より後にしてください。");
      return;
    }
    setSaving(true); setError("");
    try {
      await supporterFetch("/api/supporter/invitations", { method: "POST", body: JSON.stringify({
        childId: Number(form.childId), recipientAddress: form.recipientCode.trim(), startsAt, endsAt,
      }) });
      setForm({ childId: "", recipientCode: "", startsAt: nowJstInput(), endsAt: "" });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "招待を作成できませんでした。"); }
    finally { setSaving(false); }
  };
  const extendInvite = async () => {
    if (!extend || !extendEnd) return;
    const invitation = data?.invitations.find((item) => item.id === extend);
    const nextEnd = fromJstInput(extendEnd);
    if (invitation && Date.parse(nextEnd) <= Date.parse(invitation.endsAt)) {
      setError("終了日時は現在の終了日時より後にしてください。");
      return;
    }
    setSaving(true); setError("");
    try {
      await supporterFetch(`/api/supporter/invitations/${extend}`, { method: "PATCH", body: JSON.stringify({ endsAt: nextEnd }) });
      setExtend(undefined); setExtendEnd(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "期限を更新できませんでした。"); }
    finally { setSaving(false); }
  };
  const revoke = async (id: number) => {
    if (!window.confirm("この招待・利用権限を取り消しますか？")) return;
    setSaving(true); setError("");
    try { await supporterFetch(`/api/supporter/invitations/${id}/revoke`, { method: "POST" }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "取り消しできませんでした。"); }
    finally { setSaving(false); }
  };

  return <SupporterStatusPanel status={status} loading={loading} error={statusError} manage>
    <main className="min-h-screen bg-slate-50 pb-12"><div className="mx-auto max-w-3xl p-4 space-y-5">
      <header className="flex justify-between items-center"><div><h1 className="text-xl font-black">サポーター管理</h1><p className="text-sm text-gray-500">アカウントに紐付く利用権限を管理します</p></div><div className="flex gap-2">{import.meta.env.DEV && <Link href="/supporter/development"><Button variant="outline">開発用の架空アカウント切替</Button></Link>}<Link href="/settings"><Button variant="outline">設定へ戻る</Button></Link></div></header>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">招待URLや新しいログインの発行は行いません。施設側で確認済みの既存共通アカウントを PUBLIC CODE で指定します。日時はすべてJSTです。</p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={create} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-bold">サポーターを招待</h2>
         <div><Label htmlFor="supporter-child">お子さま</Label><select id="supporter-child" required className="mt-1 w-full rounded-md border p-2" value={form.childId} onChange={(e) => setForm({ ...form, childId: e.target.value })}><option value="">選択してください</option>{data?.children.map((child) => <option key={child.id} value={child.id}>{child.name}（{child.birthday}）</option>)}</select></div>
         <div><Label htmlFor="supporter-recipient-code">施設アカウントの公開コード（PUBLIC CODE）</Label><Input id="supporter-recipient-code" required type="text" autoComplete="off" spellCheck={false} placeholder="施設から受け取った PUBLIC CODE" value={form.recipientCode} onChange={(e) => setForm({ ...form, recipientCode: e.target.value })} /><p className="mt-1 text-xs text-gray-500">施設の既存共通アカウントに表示されるコードです。メールアドレスや新しいログイン情報は入力しません。</p></div>
         <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="supporter-starts-at">開始（JST）</Label><Input id="supporter-starts-at" required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div><div><Label htmlFor="supporter-ends-at">終了（JST）</Label><Input id="supporter-ends-at" required type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div></div>
        <Button disabled={saving} type="submit">{saving ? "保存中…" : "招待を作成"}</Button>
      </form>
      <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">招待・利用権限</h2><div className="mt-3 space-y-3">
        {!data?.invitations.length && <p className="text-sm text-gray-500">招待はありません。</p>}
         {data?.invitations.map((invite) => {
           const state = supporterInvitationState(invite, new Date(now).toISOString());
           const canChange = state !== "取り消し済み" && state !== "期限切れ";
           return <div className="rounded-lg border p-3 text-sm" key={invite.id}>
             <p className="font-bold">{invite.childName} — {invite.displayName || "共通アカウント"}</p>
             <p className="text-gray-600">PUBLIC CODE: {invite.recipientAddress}</p>
             <p className="mt-1 text-xs text-gray-500">利用期間（JST）: {jstDateTime(invite.startsAt)} 〜 {jstDateTime(invite.endsAt)}</p>
             <p className="text-xs text-gray-500">状態: {state}</p>
             {invite.acceptedAt && <p className="text-xs text-gray-500">受け入れ済み: {jstDateTime(invite.acceptedAt)}</p>}
             {invite.revokedAt && <p className="text-xs text-gray-500">取り消し済み: {jstDateTime(invite.revokedAt)}</p>}
             {canChange && <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setExtend(invite.id); setExtendEnd(toJstInput(invite.endsAt)); }}>期限を変更</Button><Button size="sm" variant="outline" className="text-red-600" disabled={saving} onClick={() => revoke(invite.id)}>取り消す</Button></div>}
           </div>;
         })}
      </div></section>
       {extend && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-5"><h2 className="font-bold">利用期限を変更</h2><p className="mt-1 text-xs text-gray-500">終了日時は現在の終了日時より後にしてください。</p><Label htmlFor="supporter-extend-end" className="mt-3 block">終了（JST）</Label><Input id="supporter-extend-end" type="datetime-local" value={extendEnd} onChange={(e) => setExtendEnd(e.target.value)} /><div className="mt-4 flex gap-2"><Button variant="outline" onClick={() => setExtend(undefined)}>キャンセル</Button><Button disabled={saving} onClick={extendInvite}>更新する</Button></div></div></div>}
    </div></main>
  </SupporterStatusPanel>;
}