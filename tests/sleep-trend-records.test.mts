import assert from "node:assert/strict";
import { sleepTrendRecords } from "../shared/sleep-trend-records";

const start = {
  id: 1, type: "sleep", sleepSessionId: 10,
  settlingMethod: "抱っこ・トントン", settlingMinutes: 15, sleepLocation: "ベビーベッド",
};
const wake = { ...start, id: 2 };
assert.deepEqual(sleepTrendRecords([wake, start]), [wake], "one sample per session regardless of input order");
assert.deepEqual(
  sleepTrendRecords([start, { ...wake, settlingMethod: null, settlingMinutes: null, sleepLocation: null }]),
  [wake],
  "legacy wake records inherit start details",
);
const override = { ...wake, settlingMethod: "授乳", settlingMinutes: 5, sleepLocation: "添い寝" };
assert.deepEqual(sleepTrendRecords([start, override]), [override], "wake edits win");
const cleared = { ...wake, settlingMethod: "", settlingMinutes: 0, sleepLocation: "" };
assert.deepEqual(sleepTrendRecords([start, cleared]), [cleared], "explicit clearing is not undone");
assert.equal(sleepTrendRecords([start]).length, 1, "active sleep included");
assert.equal(sleepTrendRecords([
  start, wake,
  { ...start, id: 3, sleepSessionId: 11 },
  { ...start, id: 4, sleepSessionId: null },
  { ...start, id: 5, sleepSessionId: null },
  { ...start, id: 6, type: "milk" },
]).length, 4, "other sessions and unlinked legacy logs remain independent");
const inputs = [wake, start];
sleepTrendRecords(inputs);
assert.equal(inputs[0], wake, "does not mutate input order");
console.log("sleep-trend-records: all passed");