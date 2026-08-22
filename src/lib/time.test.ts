import assert from "node:assert/strict";
import { monthGrid, pad, shiftMonth } from "./time";

const aug = monthGrid(2026, 8);
assert.equal(aug[0], null); // Sat 1st 2026 → 6 leading pads? Aug 1 2026 is Saturday.
assert.equal(new Date("2026-08-01T12:00:00").getDay(), 6);
assert.equal(aug.filter((c) => c === null).length, 6);
assert.equal(aug.filter(Boolean).length, 31);
assert.equal(aug[6], "2026-08-01");
assert.equal(aug.at(-1), "2026-08-31");

const next = shiftMonth(2026, 12, 1);
assert.deepEqual(next, { year: 2027, month: 1 });
assert.equal(pad(3), "03");

console.log("time tests ok");
