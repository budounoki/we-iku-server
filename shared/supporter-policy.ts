import type { SupporterRecordType } from "./supporter-contract";

/**
 * A grant is usable only after the recipient has accepted it.  Keep that
 * state in the shared policy contract instead of relying on each endpoint to
 * remember the pending-invitation case.
 *
 * `acceptedAt` is optional for callers that are adapting legacy rows, but an
 * omitted value is deliberately treated as not accepted.  This makes policy
 * decisions fail closed when an incomplete row reaches this layer.
 */
export type GrantPeriod = {
  startsAt: Date;
  endsAt: Date;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
};

function isAcceptedGrant(grant: GrantPeriod): boolean {
  return grant.acceptedAt instanceof Date && !Number.isNaN(grant.acceptedAt.getTime());
}

export const historicalSupporterTypes = new Set<SupporterRecordType>([
  "allergy_report",
  "handoff_note",
]);

export function isActiveGrant(grant: GrantPeriod, now = new Date()): boolean {
  return isAcceptedGrant(grant)
    && !grant.revokedAt
    && grant.startsAt <= now
    && now < grant.endsAt;
}

export function isWithinGrantPeriod(occurredAt: Date, grants: GrantPeriod[]): boolean {
  return grants.some((grant) => isAcceptedGrant(grant)
    && !grant.revokedAt
    && grant.startsAt <= occurredAt && occurredAt < grant.endsAt);
}

export function isIntervalWithinGrantPeriod(start: Date, end: Date, grants: GrantPeriod[]): boolean {
  // A record interval must have a real positive duration.  This also keeps a
  // malformed zero-length sleep from being authorized at an arbitrary point.
  return start < end && grants.some((grant) => isAcceptedGrant(grant)
    && !grant.revokedAt
    && grant.startsAt <= start && end <= grant.endsAt);
}

export function canShareSupporterRecord(
  type: SupporterRecordType,
  occurredAt: Date,
  grants: GrantPeriod[],
): boolean {
  // Historical allergy/handoff exceptions still require at least one
  // accepted, non-revoked grant.  The route layer additionally supplies only
  // currently active grants, but keeping this invariant here prevents a
  // pending or revoked grant from becoming a sharing capability at another
  // call site.
  const hasUsableGrant = grants.some((grant) => isAcceptedGrant(grant) && !grant.revokedAt);
  return hasUsableGrant
    && (historicalSupporterTypes.has(type) || isWithinGrantPeriod(occurredAt, grants));
}

export function canShareExistingHealthRecord(type: string, childId: number | null): boolean {
  return childId !== null && (type === "allergy" || type === "health_note");
}