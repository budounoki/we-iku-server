export type SupporterStatus = {
  enabled: boolean;
  authenticated: boolean;
  canManage: boolean;
  isSupporter: boolean;
  displayName?: string;
  message?: string;
};

export type SupporterGrant = { id: number; startsAt: string; endsAt: string };
export type SupporterChild = { id: number; name: string; birthday: string; grants: SupporterGrant[] };
export type SupporterFieldValue = string | number | boolean | null;
export type SupporterRecord = {
  id: number;
  type: string;
  createdAt: string;
  message?: string;
  recorderDisplayName: string;
  canEdit: boolean;
  fields: Record<string, SupporterFieldValue>;
};

export type SupporterRecordsResponse = {
  child: Omit<SupporterChild, "grants">;
  records: SupporterRecord[];
  grants: SupporterGrant[];
  serverNow: string;
};

/**
 * A grant is addressed to an already-provisioned supporter account.  The
 * server calls the matching value `recipientAddress` for compatibility with
 * its existing contract; it is a public account code in the UI, not an email
 * address or a new login credential.
 */
export type SupporterInvitation = {
  id: number;
  childId?: number;
  childName: string;
  recipientAddress?: string;
  displayName?: string;
  startsAt: string;
  endsAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
};

export type SupporterInvitationState = "受け入れ待ち" | "受け入れ済み" | "期限切れ" | "取り消し済み";

export function supporterInvitationState(
  invitation: Pick<SupporterInvitation, "startsAt" | "endsAt" | "acceptedAt" | "revokedAt">,
  now: string = new Date().toISOString(),
): SupporterInvitationState {
  if (invitation.revokedAt) return "取り消し済み";
  if (Date.parse(invitation.endsAt) <= Date.parse(now)) return "期限切れ";
  if (invitation.acceptedAt) return "受け入れ済み";
  return "受け入れ待ち";
}

export const SUPPORTER_RECORD_TYPES = [
  "milk", "formula", "diaper", "sleep", "bath", "food", "temp", "symptom", "medicine",
  "allergy_report", "allergy_observation", "handoff_note",
] as const;

export const SUPPORTER_RECORD_LABELS: Record<string, string> = {
  milk: "ミルク",
  formula: "ミルク",
  diaper: "おむつ",
  sleep: "睡眠",
  bath: "入浴",
  food: "食事",
  temp: "体温",
  symptom: "症状メモ",
  medicine: "お薬",
  allergy_report: "アレルギーの申告",
  allergy_observation: "アレルギーに関する観察",
  handoff_note: "申し送り",
};

export async function supporterFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("通信が切れています。保存できません");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("通信が切れています。保存できません");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function activeGrants(grants: SupporterGrant[], serverNow: string): SupporterGrant[] {
  const now = Date.parse(serverNow);
  const seen = new Set<number>();
  return grants.filter((grant) => {
    if (seen.has(grant.id)) return false;
    seen.add(grant.id);
    return Date.parse(grant.startsAt) <= now && now < Date.parse(grant.endsAt);
  });
}

export function jstDateTime(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

export function toJstInput(value: string): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value)).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Converts a datetime-local value as entered in JST, regardless of device timezone. */
export function fromJstInput(value: string): string {
  return new Date(`${value}:00+09:00`).toISOString();
}

export function newRequestId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}