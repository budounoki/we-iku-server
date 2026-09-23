import assert from "node:assert/strict";
import {
  canShareExistingHealthRecord,
  canShareSupporterRecord,
  isActiveGrant,
  isIntervalWithinGrantPeriod,
  isWithinGrantPeriod,
} from "../shared/supporter-policy.ts";
import { strictUtcIsoSchema } from "../shared/supporter-contract.ts";

const start = new Date("2026-01-01T09:00:00.000Z");
const end = new Date("2026-01-01T17:00:00.000Z");
const acceptedAt = new Date("2025-12-31T00:00:00.000Z");
const grant = { startsAt: start, endsAt: end, acceptedAt, revokedAt: null };

assert.equal(isActiveGrant(grant, start), true, "grant starts inclusively");
assert.equal(isActiveGrant(grant, end), false, "grant ends exclusively");
assert.equal(isWithinGrantPeriod(start, [grant]), true);
assert.equal(isWithinGrantPeriod(end, [grant]), false);
assert.equal(
  isActiveGrant({ ...grant, acceptedAt: null }, start),
  false,
  "pending invitations never authorize access",
);
assert.equal(
  isActiveGrant({ ...grant, revokedAt: new Date("2026-01-01T10:00:00.000Z") }, start),
  false,
  "revoked invitations never authorize access",
);
assert.equal(isIntervalWithinGrantPeriod(start, end, [grant]), true);
assert.equal(
  isIntervalWithinGrantPeriod(start, start, [grant]),
  false,
  "zero-length intervals are not valid care intervals",
);
assert.equal(
  isIntervalWithinGrantPeriod(new Date("2026-01-01T16:30:00.000Z"), new Date("2026-01-01T17:30:00.000Z"), [grant]),
  false,
  "a sleep interval may not run beyond the grant end",
);
assert.equal(
  canShareSupporterRecord("milk", new Date("2026-01-01T08:59:59.999Z"), [grant]),
  false,
  "daily records before a newly issued grant are never re-shared",
);
assert.equal(
  canShareSupporterRecord("allergy_report", new Date("2025-12-01T00:00:00.000Z"), [grant]),
  true,
  "historic parent allergy reports remain safely visible",
);
assert.equal(
  canShareSupporterRecord("allergy_report", new Date("2025-12-01T00:00:00.000Z"), [{ ...grant, acceptedAt: null }]),
  false,
  "pending invitations do not enable historical exceptions",
);
assert.equal(
  canShareSupporterRecord("handoff_note", new Date("2025-12-01T00:00:00.000Z"), [{
    ...grant,
    revokedAt: new Date("2026-01-01T10:00:00.000Z"),
  }]),
  false,
  "revoked invitations do not enable historical exceptions",
);
assert.equal(
  canShareSupporterRecord("handoff_note", new Date("2025-12-01T00:00:00.000Z"), [grant]),
  true,
  "historic handoff notes remain safely visible",
);
assert.equal(canShareExistingHealthRecord("allergy", 12), true);
assert.equal(canShareExistingHealthRecord("health_note", 12), true);
assert.equal(canShareExistingHealthRecord("allergy", null), false, "unbound legacy rows stay private");
assert.equal(canShareExistingHealthRecord("diagnosis", 12), false);
assert.equal(strictUtcIsoSchema.safeParse("2026-01-01T09:00:00.000Z").success, true);
assert.equal(strictUtcIsoSchema.safeParse("2026-01-01T09:00:00Z").success, false);
assert.equal(strictUtcIsoSchema.safeParse("2026-01-01T09:00:00.000+09:00").success, false);

console.log("supporter policy tests passed");