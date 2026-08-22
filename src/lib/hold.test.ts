import assert from "node:assert/strict";
import { holdExpiresAt, isHoldOpen, HOLD_MS } from "./hold";

const t0 = new Date("2026-08-22T16:00:00Z");
const exp = holdExpiresAt(t0);
assert.equal(exp.getTime() - t0.getTime(), HOLD_MS);
assert.equal(isHoldOpen(exp, t0), true);
assert.equal(isHoldOpen(exp, new Date(t0.getTime() + HOLD_MS + 1)), false);
assert.equal(isHoldOpen(null, t0), false);
console.log("hold tests ok");
