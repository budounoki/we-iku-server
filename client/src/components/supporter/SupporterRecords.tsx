import { useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupporterRecord, SUPPORTER_RECORD_LABELS, jstDateTime, newRequestId, supporterFetch } from "@/lib/supporter";

const detail = (record: SupporterRecord) => {
  const values = record.fields || {};
  const parts = [record.message];
  if (values.formulaMl !== undefined && values.formulaMl !== null && values.formulaMl !== "") parts.push(`粉ミルク ${values.formulaMl}ml`);
  if (values.expressedMl !== undefined && values.expressedMl !== null && values.expressedMl !== "") parts.push(`搾乳 ${values.expressedMl}ml`);
  if (values.subType !== undefined && values.subType !== null && values.subType !== "") parts.push(String(values.subType));
  if (values.durationMin !== undefined && values.durationMin !== null && values.durationMin !== "") parts.push(`${values.durationMin}分`);
  if (values.bodyTemperature !== undefined && values.bodyTemperature !== null && values.bodyTemperature !== "") parts.push(`${values.bodyTemperature}℃`);
  if (values.medicineName !== undefined && values.medicineName !== null && values.medicineName !== "") {
    const dose = values.medicineDose !== undefined && values.medicineDose !== null && values.medicineDose !== "" ? ` ${values.medicineDose}` : "";
    parts.push(`${values.medicineName}${dose}`);
  }
  return parts.filter(Boolean).join("／") || "—";
};

export function SupporterRecords({
  childId, grantId, records, onEdit, onChanged,
}: {
  childId: number;
  grantId?: number;
  records: SupporterRecord[];
  onEdit: (record: SupporterRecord) => void;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState<number>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const deleteRequest = useRef<{ payload: string; id: string }>();
  const grouped = useMemo(() => records.reduce<Record<string, SupporterRecord[]>>((groups, record) => {
    const day = jstDateTime(record.createdAt).slice(0, 10);
    (groups[day] ||= []).push(record);
    return groups;
  }, {}), [records]);
  const remove = async () => {
    if (!deleting || !grantId || !reason.trim()) {
      setError(!grantId ? "利用期限が終了しました。" : "削除理由を入力してください。");
      return;
    }
    if (removing) return;
    const payload = JSON.stringify({ grantId, id: deleting, reason: reason.trim() });
    if (!deleteRequest.current || deleteRequest.current.payload !== payload) {
      deleteRequest.current = { payload, id: newRequestId() };
    }
    setRemoving(true);
    try {
      await supporterFetch(`/api/supporter/children/${childId}/records/${deleting}`, {
        method: "DELETE",
        body: JSON.stringify({ grantId, requestId: deleteRequest.current.id, reason: reason.trim() }),
      });
      setDeleting(undefined);
      setReason("");
      setError("");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "削除できませんでした。");
    } finally {
      setRemoving(false);
    }
  };
  return <section className="space-y-4">
    <h2 className="font-bold text-gray-800">記録（日別）</h2>
    {!records.length && <p className="rounded-xl bg-white p-4 text-sm text-gray-500">まだ記録がありません。</p>}
    {Object.entries(grouped).map(([day, daily]) => <div key={day} className="rounded-xl border bg-white">
      <h3 className="border-b px-4 py-3 text-sm font-bold">{day}（JST）</h3>
      {daily.map((record) => <div key={record.id} className="border-b last:border-0 px-4 py-3 text-sm">
        <div className="flex gap-2"><span className="w-28 shrink-0 text-gray-500">{jstDateTime(record.createdAt).slice(-5)}</span><span className="font-medium">{SUPPORTER_RECORD_LABELS[record.type] || record.type}</span></div>
        <p className="ml-28 mt-1 text-gray-700">{detail(record)}</p>
        <p className="ml-28 mt-1 text-xs text-gray-500">記録者: {record.recorderDisplayName}</p>
        {record.canEdit && <div className="ml-28 mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(record)}><Pencil className="mr-1 w-3 h-3" />修正</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => { setDeleting(record.id); setReason(""); deleteRequest.current = undefined; setError(""); }}><Trash2 className="mr-1 w-3 h-3" />削除</Button></div>}
      </div>)}
    </div>)}
    {deleting && <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="font-bold text-red-800">この記録を削除しますか？</p><Input className="mt-2 bg-white" placeholder="削除理由（必須）" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => setDeleting(undefined)} disabled={removing}>キャンセル</Button><Button className="bg-red-600 hover:bg-red-700" onClick={remove} disabled={removing}>理由を付けて削除</Button></div>
    </div>}
  </section>;
}