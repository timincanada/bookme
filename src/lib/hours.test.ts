import assert from "node:assert/strict";
import {
  MAX_SEGMENTS_PER_DAY,
  endAfterStart,
  segmentsOverlap,
  validateDaySegments,
  validateWeeklyHours,
} from "./hours";

assert.equal(MAX_SEGMENTS_PER_DAY, 3);
assert.equal(endAfterStart(600, 720), true);
assert.equal(endAfterStart(600, 600), false);
assert.equal(endAfterStart(720, 600), false);

assert.equal(segmentsOverlap({ startMin: 600, endMin: 720 }, { startMin: 700, endMin: 800 }), true);
assert.equal(segmentsOverlap({ startMin: 600, endMin: 720 }, { startMin: 720, endMin: 800 }), false);
assert.equal(segmentsOverlap({ startMin: 600, endMin: 720 }, { startMin: 500, endMin: 600 }), false);

assert.equal(validateDaySegments([{ startMin: 600, endMin: 720 }]).ok, true);
assert.equal(validateDaySegments([{ startMin: 600, endMin: 600 }]).ok, false);
assert.equal(
  validateDaySegments([
    { startMin: 600, endMin: 720 },
    { startMin: 700, endMin: 800 },
  ]).ok,
  false,
);
assert.equal(
  validateDaySegments([
    { startMin: 600, endMin: 720 },
    { startMin: 720, endMin: 800 },
  ]).ok,
  true,
);
assert.equal(
  validateDaySegments([
    { startMin: 540, endMin: 720 },
    { startMin: 780, endMin: 1020 },
    { startMin: 1080, endMin: 1200 },
  ]).ok,
  true,
);
assert.equal(
  validateDaySegments([
    { startMin: 540, endMin: 720 },
    { startMin: 780, endMin: 1020 },
    { startMin: 1080, endMin: 1200 },
    { startMin: 1200, endMin: 1260 },
  ]).ok,
  false,
);

const ok = validateWeeklyHours([
  { weekday: 1, startMin: 600, endMin: 720 },
  { weekday: 1, startMin: 780, endMin: 1080 },
  { weekday: 2, startMin: 600, endMin: 1200 },
]);
assert.equal(ok.ok, true);

const badOverlap = validateWeeklyHours([
  { weekday: 0, startMin: 600, endMin: 800 },
  { weekday: 0, startMin: 700, endMin: 900 },
]);
assert.equal(badOverlap.ok, false);

const empty = validateWeeklyHours([]);
assert.equal(empty.ok, false);

console.log("hours tests ok");
