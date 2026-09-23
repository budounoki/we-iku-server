/**
 * Shared, side-effect-free rules for attributing care records.
 *
 * Supporter metadata is deliberately additive.  A record without either
 * supporter marker is treated exactly like a legacy parent record; this is
 * important because old rows must not be rewritten or inferred.
 */
export type CareRecordAttribution = {
  careSource?: string | null;
  supporterAccountId?: number | string | null;
  supporterGrantId?: number | string | null;
  recorderDisplayName?: string | null;
  points?: number | null;
  deletedAt?: string | Date | null;
};

/** Labels for records introduced by the supporter compatibility contract. */
export const CARE_RECORD_TYPE_LABELS: Record<string, string> = {
  allergy_report: "アレルギーの申告",
  allergy_observation: "アレルギーに関する観察",
  handoff_note: "申し送り",
};

export function careRecordTypeLabel(type: string, fallback = type): string {
  return CARE_RECORD_TYPE_LABELS[type] || fallback;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Returns true only when the row carries an explicit supporter marker.
 *
 * supporterGrantId is intentionally not used on its own.  It is audit
 * context, while careSource/supporterAccountId are the attribution fields
 * specified by the compatibility contract.
 */
export function isSupporterCare(record: CareRecordAttribution | null | undefined): boolean {
  if (!record) return false;
  return record.careSource === "supporter" || hasValue(record.supporterAccountId);
}

export function isSoftDeletedCareRecord(record: CareRecordAttribution | null | undefined): boolean {
  return !!record && hasValue(record.deletedAt);
}

/** Standard app views must not render soft-deleted rows. */
export function visibleCareRecords<T extends CareRecordAttribution>(records: readonly T[]): T[] {
  return records.filter((record) => !isSoftDeletedCareRecord(record));
}

/**
 * Parent contribution views (points, counts, rates and derived awards) only
 * include parent-attributed rows.  This does not affect child-care metrics.
 */
export function parentContributionRecords<T extends CareRecordAttribution>(records: readonly T[]): T[] {
  return visibleCareRecords(records).filter((record) => !isSupporterCare(record));
}

/** Child daily/health/sleep views include supporter care as well as parent care. */
export function childCareRecords<T extends CareRecordAttribution>(records: readonly T[]): T[] {
  return visibleCareRecords(records);
}

export function sumParentPoints(records: readonly CareRecordAttribution[]): number {
  return parentContributionRecords(records).reduce(
    (total, record) => total + (typeof record.points === "number" ? record.points : 0),
    0,
  );
}

export function countParentContributions(records: readonly CareRecordAttribution[]): number {
  return parentContributionRecords(records).length;
}

/**
 * Returns a supporter recorder label, or null for a parent/legacy record.
 * Parent performedBy values (including "other") are intentionally left to
 * the caller so they retain their existing meaning.
 */
export function supporterRecorderDisplayName(
  record: CareRecordAttribution | null | undefined,
  fallback = "その他",
): string | null {
  if (!isSupporterCare(record)) return null;
  const displayName = typeof record?.recorderDisplayName === "string"
    ? record.recorderDisplayName.trim()
    : "";
  return displayName || fallback;
}