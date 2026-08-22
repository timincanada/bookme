import assert from "node:assert/strict";
import { REMIND_2H_MS, REMIND_24H_MS, dueReminders } from "./remind";

const now = new Date("2026-08-22T12:00:00Z");
const start = (ms: number) => new Date(now.getTime() + ms);

assert.deepEqual(
  dueReminders({ status: "confirmed", startAt: start(REMIND_24H_MS), reminded24h: false, reminded2h: false }, now),
  ["24h"],
);
assert.deepEqual(
  dueReminders({ status: "confirmed", startAt: start(REMIND_24H_MS + 1), reminded24h: false, reminded2h: false }, now),
  [],
);
assert.deepEqual(
  dueReminders({ status: "confirmed", startAt: start(REMIND_2H_MS), reminded24h: false, reminded2h: false }, now),
  ["24h", "2h"],
);
assert.deepEqual(
  dueReminders({ status: "confirmed", startAt: start(REMIND_2H_MS), reminded24h: true, reminded2h: false }, now),
  ["2h"],
);
assert.deepEqual(dueReminders({ status: "cancelled", startAt: start(REMIND_2H_MS) }, now), []);
assert.deepEqual(dueReminders({ status: "held", startAt: start(REMIND_2H_MS) }, now), []);
assert.deepEqual(dueReminders({ status: "confirmed", startAt: start(-1) }, now), []);
assert.deepEqual(
  dueReminders({ status: "confirmed", startAt: start(REMIND_24H_MS), reminded24h: true, reminded2h: true }, now),
  [],
);

console.log("remind tests ok");
