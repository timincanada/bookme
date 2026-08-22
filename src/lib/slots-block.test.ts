import assert from "node:assert/strict";
import { overlapsBlock } from "./slots";

// Afternoon window 12:00-18:00 must not cover a 10:00 morning slot.
assert.equal(overlapsBlock(10 * 60, 60, 12 * 60, 18 * 60), false);
assert.equal(overlapsBlock(11 * 60, 60, 12 * 60, 18 * 60), false);
assert.equal(overlapsBlock(12 * 60, 60, 12 * 60, 18 * 60), true);
assert.equal(overlapsBlock(17 * 60, 60, 12 * 60, 18 * 60), true);
assert.equal(overlapsBlock(18 * 60, 60, 12 * 60, 18 * 60), false);

// Old whole-day rows default to 0-1440.
assert.equal(overlapsBlock(10 * 60, 60, 0, 1440), true);
assert.equal(overlapsBlock(10 * 60, 60, undefined, undefined), true);

console.log("slots-block tests ok");
