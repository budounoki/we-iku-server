import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { FileDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupporterRecordForm } from "@/components/supporter/SupporterRecordForm";
import { SupporterRecords } from "@/components/supporter/SupporterRecords";
import { SupporterStatusPanel } from "@/components/supporter/SupporterStatus";
import {
  activeGrants,
  SupporterChild,
  SupporterInvitation,
  SupporterRecord,
  SupporterRecordsResponse,
  SupporterStatus,
  jstDateTime,
  supporterFetch,
  supporterInvitationState,
} from "@/lib/supporter";
import { canPrintFreshExport, printSupporterExport, SupporterExportResponse } from "@/lib/supporter-print";

type ChildrenResponse = { children: SupporterChild[]; serverNow: string };
type RecipientInvite = SupporterInvitation;

export default function SupporterPortal() {
  const [status, setStatus] = useState<SupporterStatus>();
  const [statusError, setStatusError] = useState("");
  const [childrenData, setChildrenData] = useState<ChildrenResponse>();
  const [selectedId, setSelectedId] = useState<number>();
  const [recordsData, setRecordsData] = useState<SupporterRecordsResponse>();
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<"new" | SupporterRecord>();
  const [dirty, setDirty] = useState(false);
  const [pendingChild, setPendingChild] = useState<number>();
  const [invites, setInvites] = useState<RecipientInvite[]>([]);
  const readController = useRef<AbortController>();
  const selectedRef = useRef<number>();
  const exportController = useRef<AbortController>();
  const exportEpoch = useRef(0);
  const childrenEpoch = useRef(0);
  const serverClock = useRef<{ server: number; received: number }>();
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  const selected = childrenData?.children.find((child) => child.id === selectedId);
  // Children have already been active-filtered. This deliberately excludes
  // serverNow so routine clock polls do not unmount an in-progress draft.
  const selectedAccessSignature = selected
    ? `${selected.id}:${selected.grants.map((grant) => `${grant.id}:${grant.startsAt}:${grant.endsAt}`).join("|")}`
    : "";
  const rememberServerClock = (serverNow: string) => {
    const parsed = Date.parse(serverNow);
    if (Number.isFinite(parsed)) serverClock.current = { server: parsed, received: Date.now() };
  };
  const currentServerNow = () => {
    const clock = serverClock.current;
    return new Date(clock ? clock.server + (Date.now() - clock.received) : Date.now()).toISOString();
  };

  const loadStatus = async () => {
    try { setStatus(await supporterFetch<SupporterStatus>("/api/supporter/status")); }
    catch (caught) { setStatusError(caught instanceof Error ? caught.message : "利用状態を確認できません。"); }
    finally { setLoading(false); }
  };
  const loadChildren = async () => {
    try {
      const epoch = ++childrenEpoch.current;
      const data = await supporterFetch<ChildrenResponse>("/api/supporter/children");
      if (epoch !== childrenEpoch.current) return;
      rememberServerClock(data.serverNow);
      const adjustedNow = currentServerNow();
      const live = data.children
        .map((child) => ({ ...child, grants: activeGrants(child.grants, adjustedNow) }))
        .filter((child) => child.grants.length);
      setChildrenData({ ...data, serverNow: adjustedNow, children: live });
      setSelectedId((current) => live.some((child) => child.id === current) ? current : live[0]?.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "お子さま情報を取得できません。"); }
  };
  const loadInvites = async () => {
    try {
      const response = await supporterFetch<RecipientInvite[] | { invitations: RecipientInvite[] }>("/api/supporter/invitations");
      setInvites(Array.isArray(response) ? response : response.invitations || []);
    } catch { /* invitations are supplemental */ }
  };
  useEffect(() => { loadStatus(); }, []);
  useEffect(() => {
    if (!status?.enabled || !status.authenticated || !status.isSupporter) return;
    loadChildren(); loadInvites();
    const poll = window.setInterval(() => { loadStatus(); loadChildren(); }, 30_000);
    return () => window.clearInterval(poll);
  }, [status?.enabled, status?.authenticated, status?.isSupporter]);
  useEffect(() => {
    readController.current?.abort();
    exportController.current?.abort();
    exportEpoch.current += 1;
    setRecordsData(undefined);
    setForm(undefined);
    setDirty(false);
    if (!selectedId || !childrenData) return;
    const selected = childrenData.children.find((child) => child.id === selectedId);
    if (!selected || !activeGrants(selected.grants, childrenData.serverNow).length) return;
    const controller = new AbortController();
    readController.current = controller;
    setRecordsLoading(true);
    supporterFetch<SupporterRecordsResponse>(`/api/supporter/children/${selectedId}/records`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { rememberServerClock(data.serverNow); setRecordsData(data); } })
      .catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "記録を取得できません。"); })
      .finally(() => { if (!controller.signal.aborted) setRecordsLoading(false); });
    return () => controller.abort();
  }, [selectedId, selectedAccessSignature]);

  useEffect(() => {
    if (!selected || !childrenData) return;
    // Wake on every grant boundary, not merely the last overlapping grant.
    // This discards any projection obtained through the grant that just ended
    // while retaining the child when another grant is still active.
    const nextExpiry = Math.min(...selected.grants.map((grant) => Date.parse(grant.endsAt)));
    const serverTime = Date.parse(childrenData.serverNow);
    const wait = nextExpiry - serverTime;
    const timer = window.setTimeout(() => {
      readController.current?.abort();
      exportController.current?.abort();
      exportEpoch.current += 1;
      childrenEpoch.current += 1;
      setRecordsData(undefined);
      setForm(undefined);
      setDirty(false);
      const now = currentServerNow();
      setChildrenData((current) => current && ({
        ...current,
        serverNow: now,
        children: current.children
          .map((child) => ({ ...child, grants: activeGrants(child.grants, now) }))
          .filter((child) => child.grants.length),
      }));
      loadChildren();
    }, Math.max(0, wait) + 20);
    return () => window.clearTimeout(timer);
  }, [selectedAccessSignature]);

  const selectChild = (id: number) => {
    if (id === selectedId) return;
    if (dirty) { setPendingChild(id); return; }
    setSelectedId(id);
  };
  const grants = recordsData?.grants || (selected ? activeGrants(selected.grants, childrenData!.serverNow) : []);
  const serverNow = recordsData?.serverNow || childrenData?.serverNow || "";
  const invitationNow = childrenData?.serverNow || currentServerNow();
  const refreshRecords = () => {
    if (!selectedId) return;
    readController.current?.abort();
    const childId = selectedId;
    const controller = new AbortController();
    readController.current = controller;
    supporterFetch<SupporterRecordsResponse>(`/api/supporter/children/${childId}/records`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted && selectedRef.current === childId) { rememberServerClock(data.serverNow); setRecordsData(data); } })
      .catch((caught) => { if (!controller.signal.aborted && selectedRef.current === childId) setError(caught instanceof Error ? caught.message : "記録を更新できません。"); });
  };
  const accept = async (id: number) => {
    try { await supporterFetch(`/api/supporter/invitations/${id}/accept`, { method: "POST" }); await loadInvites(); await loadChildren(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "受け入れできませんでした。"); }
  };
  const exportCurrent = async () => {
    if (!selected || !grants.length) return;
    const nowAtSubmit = currentServerNow();
    const activeAtSubmit = grants.filter((grant) =>
      Date.parse(grant.startsAt) <= Date.parse(nowAtSubmit) && Date.parse(nowAtSubmit) < Date.parse(grant.endsAt)
    );
    if (!activeAtSubmit.length) {
      setError("利用期限を確認できないため、印刷できません。");
      return;
    }
    exportController.current?.abort();
    const childId = selected.id;
    const epoch = ++exportEpoch.current;
    const controller = new AbortController();
    exportController.current = controller;
    const requestedGrantIds = activeAtSubmit.map((grant) => grant.id);
    try {
       const data = await supporterFetch<SupporterExportResponse>(`/api/supporter/children/${childId}/export`, { method: "POST", body: JSON.stringify({ grantIds: requestedGrantIds }), signal: controller.signal });
      if (controller.signal.aborted || selectedRef.current !== childId || epoch !== exportEpoch.current) return;
      const now = currentServerNow();
      const stillActive = activeAtSubmit.filter((grant) => Date.parse(grant.startsAt) <= Date.parse(now) && Date.parse(now) < Date.parse(grant.endsAt));
      if (stillActive.length !== requestedGrantIds.length || !canPrintFreshExport(data, now)) throw new Error("利用期限を確認できないため、印刷できません。");
       await printSupporterExport(data, {
         validateAfterFonts: async () => {
           if (controller.signal.aborted || selectedRef.current !== childId || epoch !== exportEpoch.current) return false;
           const latest = await supporterFetch<SupporterRecordsResponse>(
             `/api/supporter/children/${childId}/records`,
             { signal: controller.signal },
           );
           if (controller.signal.aborted || selectedRef.current !== childId || epoch !== exportEpoch.current) return false;
           rememberServerClock(latest.serverNow);
           const afterFontsNow = currentServerNow();
           const latestGrantIds = new Set(
             activeGrants(latest.grants, afterFontsNow).map((grant) => grant.id),
           );
           return latest.child.id === childId
             && requestedGrantIds.every((grantId) => latestGrantIds.has(grantId))
             && canPrintFreshExport(data, afterFontsNow);
         },
       });
    } catch (caught) {
      if (controller.signal.aborted || selectedRef.current !== childId || epoch !== exportEpoch.current) return;
      setError(caught instanceof Error ? caught.message : "出力できませんでした。");
    }
  };

  return <SupporterStatusPanel status={status} loading={loading} error={statusError}>
    <main className="min-h-screen bg-slate-50 pb-12"><div className="mx-auto max-w-3xl p-4 space-y-4">
       <header className="flex items-center justify-between"><div><h1 className="text-xl font-black text-gray-800">サポーターポータル</h1><p className="text-sm text-gray-500">{status?.displayName || "サポーター"} さん</p></div><div className="flex gap-2">{import.meta.env.DEV && <Link href="/supporter/development"><Button variant="outline">開発用の架空アカウント切替</Button></Link>}<Link href="/"><Button variant="outline">戻る</Button></Link></div></header>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">利用期限外になると期限切れの表示データは消去されます。オフライン中は取り消しをすぐ反映できない場合があります。</p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
       <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">招待された利用期間</h2>
         {!invites.length && <p className="mt-2 text-sm text-gray-500">招待はありません。</p>}
         <div className="mt-3 space-y-3">{invites.map((invite) => {
           const state = supporterInvitationState(invite, invitationNow);
           const canAccept = state === "受け入れ待ち";
           return <div className="rounded-lg border p-3 text-sm" key={invite.id}>
             <p className="font-bold">{invite.childName} さんへの招待</p>
             <p className="mt-1 text-xs text-gray-500">利用期間（JST）: {jstDateTime(invite.startsAt)} 〜 {jstDateTime(invite.endsAt)}</p>
             <p className="text-xs text-gray-500">状態: {state}</p>
             {invite.acceptedAt && <p className="text-xs text-gray-500">受け入れ済み: {jstDateTime(invite.acceptedAt)}</p>}
             {invite.revokedAt && <p className="text-xs text-gray-500">取り消し済み: {jstDateTime(invite.revokedAt)}</p>}
             {canAccept && <><p className="mt-1 text-xs text-gray-500">このログイン済み共通アカウントに紐付けて受け入れます。</p><Button className="mt-2" onClick={() => accept(invite.id)}>受け入れる</Button></>}
           </div>;
         })}</div>
       </section>
      <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">現在のお子さま</h2>
        {!childrenData?.children.length ? <p className="mt-2 text-sm text-gray-500">現在有効な利用期間のお子さまはいません。</p> : <div className="mt-3 flex flex-wrap gap-2">{childrenData.children.map((child) => <Button key={child.id} variant={child.id === selectedId ? "default" : "outline"} onClick={() => selectChild(child.id)}>{child.name}（{child.birthday}）</Button>)}</div>}
      </section>
      {selected && <><section className="rounded-xl border bg-white p-4"><p className="font-bold text-lg">{selected.name}</p><p className="text-sm text-gray-600">生年月日: {selected.birthday}</p><p className="mt-1 text-xs text-gray-500">有効な利用権限: {grants.length}件</p><Button className="mt-3" variant="outline" onClick={exportCurrent}><FileDown className="mr-2 w-4 h-4" />最新の記録を印刷 / PDF保存</Button></section>
        {!form && <Button onClick={() => setForm("new")}><Plus className="mr-2 w-4 h-4" />記録を追加</Button>}
        {form && <SupporterRecordForm key={`draft-${selected.id}-${typeof form === "string" ? "new" : form.id}`} childId={selected.id} grants={grants} serverNow={serverNow} edit={typeof form === "string" ? undefined : form} onDirtyChange={setDirty} onCancel={() => { setDirty(false); setForm(undefined); }} onSaved={() => { setDirty(false); setForm(undefined); refreshRecords(); }} />}
        {recordsLoading ? <p className="text-sm text-gray-500">記録を読み込んでいます…</p> : <SupporterRecords childId={selected.id} grantId={grants[0]?.id} records={recordsData?.records || []} onEdit={(record) => setForm(record)} onChanged={refreshRecords} />}
      </>}
      {pendingChild && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="max-w-sm rounded-xl bg-white p-5"><p className="font-bold">入力中の内容があります</p><p className="mt-2 text-sm text-gray-600">お子さまを切り替えると入力内容は失われます。</p><div className="mt-4 flex gap-2"><Button variant="outline" onClick={() => setPendingChild(undefined)}>入力を続ける</Button><Button onClick={() => { setDirty(false); setForm(undefined); setSelectedId(pendingChild); setPendingChild(undefined); }}>破棄して切り替える</Button></div></div></div>}
    </div></main>
  </SupporterStatusPanel>;
}