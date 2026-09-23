import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SupporterGrant, SupporterRecord, SUPPORTER_RECORD_LABELS, SUPPORTER_RECORD_TYPES,
  fromJstInput, newRequestId, supporterFetch, toJstInput,
} from "@/lib/supporter";

type Props = {
  childId: number;
  grants: SupporterGrant[];
  serverNow: string;
  edit?: SupporterRecord;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
};

type FormState = Record<string, string>;

const fieldNames = ["message", "formulaMl", "expressedMl", "bodyTemperature", "medicineName", "medicineDose", "durationMin", "subType"];
const permittedFields: Record<string, string[]> = {
  milk: ["message", "formulaMl", "expressedMl"],
  formula: ["message", "formulaMl", "expressedMl"],
  diaper: ["message", "subType"],
  sleep: ["message", "durationMin", "subType"],
  bath: ["message"],
  food: ["message"],
  temp: ["message", "bodyTemperature"],
  symptom: ["message", "subType"],
  medicine: ["message", "medicineName", "medicineDose"],
  allergy_report: ["message"],
  allergy_observation: ["message"],
  handoff_note: ["message"],
};

function initialFields(record?: SupporterRecord): FormState {
  const source = record?.fields || {};
  return fieldNames.reduce<FormState>((fields, field) => {
    const value = field === "message" ? record?.message : source[field];
    fields[field] = value === undefined || value === null ? "" : String(value);
    return fields;
  }, {});
}

export function SupporterRecordForm({ childId, grants, serverNow, edit, onDirtyChange, onSaved, onCancel }: Props) {
  const [type, setType] = useState(edit?.type || "milk");
  const [occurredAt, setOccurredAt] = useState(toJstInput(edit?.createdAt || serverNow));
  const [fields, setFields] = useState<FormState>(() => initialFields(edit));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // A draft never follows a later child/grant selection.  The server checks
  // this grant again on every write, so expiry/revocation still wins.
  const [draftGrantId] = useState(() => grants.find((grant) =>
    Date.parse(grant.startsAt) <= Date.parse(serverNow) && Date.parse(serverNow) < Date.parse(grant.endsAt)
  )?.id);
  const requestRef = useRef<{ payload: string; id: string }>();
  const alive = useRef(true);
  const controllerRef = useRef<AbortController>();

  useEffect(() => () => {
    alive.current = false;
    controllerRef.current?.abort();
  }, []);

  const update = (key: string, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    onDirtyChange(true);
  };
  const updateType = (next: string) => {
    setType(next);
    onDirtyChange(true);
  };
  const activeGrant = grants.find((grant) => grant.id === draftGrantId &&
    Date.parse(grant.startsAt) <= Date.parse(serverNow) && Date.parse(serverNow) < Date.parse(grant.endsAt));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeGrant) {
      setError("利用期限が終了しました。保存できません。");
      return;
    }
    if ((edit || false) && !reason.trim()) {
      setError("修正・削除の理由を入力してください。");
      return;
    }
    const cleanFields = Object.fromEntries(permittedFields[type].flatMap((field) => {
      const value = fields[field];
      if (value === "") return [];
      const isNumber = ["formulaMl", "expressedMl", "bodyTemperature", "durationMin"].includes(field);
      return [[field, isNumber ? Number(value) : value]];
    }));
    const payload = JSON.stringify({ type, occurredAt, fields: cleanFields, reason: reason.trim(), grantId: activeGrant.id });
    if (!requestRef.current || requestRef.current.payload !== payload) requestRef.current = { payload, id: newRequestId() };
    setSaving(true);
    setError("");
    controllerRef.current = new AbortController();
    const body = edit
      ? { grantId: activeGrant.id, requestId: requestRef.current.id, occurredAt: fromJstInput(occurredAt), fields: cleanFields, reason: reason.trim() }
      : { grantId: activeGrant.id, requestId: requestRef.current.id, type, occurredAt: fromJstInput(occurredAt), fields: cleanFields };
    try {
      await supporterFetch(`/api/supporter/children/${childId}/records${edit ? `/${edit.id}` : ""}`, {
        method: edit ? "PATCH" : "POST", body: JSON.stringify(body), signal: controllerRef.current.signal,
      });
      if (!alive.current) return;
      onDirtyChange(false);
      onSaved();
    } catch (caught) {
      if (!alive.current || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setError(caught instanceof Error ? caught.message : "保存できませんでした。未保存です。");
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const isMilk = type === "milk" || type === "formula";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-bold text-gray-800">{edit ? "記録を修正" : "記録を追加"}</h3>
      <div><Label>種別</Label><select value={type} onChange={(event) => updateType(event.target.value)} disabled={!!edit} className="mt-1 w-full rounded-md border p-2">
        {SUPPORTER_RECORD_TYPES.map((value) => <option key={value} value={value}>{SUPPORTER_RECORD_LABELS[value]}</option>)}
      </select></div>
      <div><Label>時刻（JST）</Label><Input type="datetime-local" value={occurredAt} onChange={(event) => { setOccurredAt(event.target.value); onDirtyChange(true); }} required /></div>
      {isMilk && <div className="grid grid-cols-2 gap-2"><div><Label>粉ミルク（ml）</Label><Input inputMode="numeric" value={fields.formulaMl} onChange={(e) => update("formulaMl", e.target.value)} /></div><div><Label>搾乳（ml）</Label><Input inputMode="numeric" value={fields.expressedMl} onChange={(e) => update("expressedMl", e.target.value)} /></div></div>}
      {type === "diaper" && <div><Label>おむつの種類</Label><select className="mt-1 w-full rounded-md border p-2" value={fields.subType} onChange={(e) => update("subType", e.target.value)}><option value="">選択してください</option><option value="pee">おしっこ</option><option value="poop">うんち</option><option value="both">両方</option></select></div>}
      {type === "sleep" && <div><Label>睡眠時間（分）</Label><Input inputMode="numeric" value={fields.durationMin} onChange={(e) => update("durationMin", e.target.value)} /></div>}
      {type === "temp" && <div><Label>体温（℃）</Label><Input inputMode="decimal" value={fields.bodyTemperature} onChange={(e) => update("bodyTemperature", e.target.value)} /></div>}
      {type === "medicine" && <div className="grid grid-cols-2 gap-2"><div><Label>薬名</Label><Input value={fields.medicineName} onChange={(e) => update("medicineName", e.target.value)} /></div><div><Label>量</Label><Input value={fields.medicineDose} onChange={(e) => update("medicineDose", e.target.value)} /></div></div>}
      <div><Label>{type === "allergy_observation" ? "観察内容（医学的診断ではありません）" : "メモ"}</Label><Textarea value={fields.message} onChange={(e) => update("message", e.target.value)} /></div>
      {edit && <div><Label>修正理由（必須）</Label><Input value={reason} onChange={(e) => { setReason(e.target.value); onDirtyChange(true); }} required /></div>}
      {error && <p className="text-sm text-red-600">{error.includes("通信が切れています") ? "通信が切れています。保存できません。未保存です。" : error}</p>}
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>キャンセル</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}{saving ? "保存中…" : "保存する"}</Button></div>
      <p className="text-xs text-gray-500">保存結果の再送は自動では行いません。失敗時は未保存のままです。</p>
    </form>
  );
}