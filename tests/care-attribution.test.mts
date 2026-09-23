import assert from "node:assert/strict";
import {
  childCareRecords,
  careRecordTypeLabel,
  countParentContributions,
  isSupporterCare,
  parentContributionRecords,
  sumParentPoints,
  supporterRecorderDisplayName,
  visibleCareRecords,
} from "../client/src/lib/care-attribution";

const parent = { id: 1, points: 10, performedBy: "papa" };
const legacy = { id: 2, points: 7, performedBy: "other" };
const supporter = {
  id: 3,
  points: 25,
  careSource: "supporter",
  supporterAccountId: 42,
  performedBy: "papa",
  recorderDisplayName: "ぶどうの木",
};
const supporterWithoutSource = { id: 4, points: 15, supporterAccountId: 99, performedBy: "mama" };
const deletedSupporter = { id: 5, points: 30, careSource: "supporter", deletedAt: "2026-01-01T00:00:00.000Z" };

assert.equal(isSupporterCare(parent), false, "legacy parent rows remain parent-attributed");
assert.equal(isSupporterCare(supporter), true, "careSource marks supporter care");
assert.equal(isSupporterCare(supporterWithoutSource), true, "supporter account id marks supporter care");
assert.equal(
  isSupporterCare({ supporterGrantId: 12 }),
  false,
  "grant context alone does not reinterpret an otherwise legacy row",
);

assert.deepEqual(
  parentContributionRecords([parent, legacy, supporter, supporterWithoutSource]),
  [parent, legacy],
  "supporter rows are excluded from parent contribution records",
);
assert.deepEqual(
  childCareRecords([parent, supporter]),
  [parent, supporter],
  "supporter rows remain in child-care records",
);
assert.equal(sumParentPoints([parent, supporter, supporterWithoutSource]), 10, "supporter points are excluded");
assert.equal(countParentContributions([parent, supporter, supporterWithoutSource]), 1, "supporter counts are excluded");
assert.deepEqual(visibleCareRecords([parent, deletedSupporter]), [parent], "soft-deleted rows are hidden from standard views");

assert.equal(supporterRecorderDisplayName(supporter), "ぶどうの木", "supporter display name wins");
assert.equal(supporterRecorderDisplayName({ careSource: "supporter" }), "その他", "missing supporter display name has safe fallback");
assert.equal(supporterRecorderDisplayName(legacy), null, "parent performedBy remains caller-owned");
assert.equal(careRecordTypeLabel("allergy_report"), "アレルギーの申告", "new care types have a default label");
assert.equal(careRecordTypeLabel("unknown"), "unknown", "unknown care types retain their source name");

console.log("care-attribution: all passed");