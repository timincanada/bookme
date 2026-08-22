import assert from "node:assert/strict";
import {
  HOLD_MS,
  SELF_RESCHEDULE_MS,
  canConfirmCheckout,
  canSelfReschedule,
  holdExpiresAt,
  isHoldOpen,
} from "./hold";

const t0 = new Date("2026-08-22T16:00:00Z");
const exp = holdExpiresAt(t0);
assert.equal(exp.getTime() - t0.getTime(), HOLD_MS);
assert.equal(isHoldOpen(exp, t0), true);
assert.equal(isHoldOpen(exp, new Date(t0.getTime() + HOLD_MS + 1)), false);
assert.equal(isHoldOpen(null, t0), false);

assert.equal(canConfirmCheckout("held", exp, t0), true);
assert.equal(canConfirmCheckout("held", exp, new Date(exp.getTime() + 1)), false);
assert.equal(canConfirmCheckout("expired", exp, t0), false);
assert.equal(canConfirmCheckout("confirmed", exp, t0), false);

const start = new Date("2026-08-23T16:00:00Z");
assert.equal(canSelfReschedule(start, new Date(start.getTime() - SELF_RESCHEDULE_MS)), true);
assert.equal(canSelfReschedule(start, new Date(start.getTime() - SELF_RESCHEDULE_MS + 1)), false);
assert.equal(SELF_RESCHEDULE_MS, 24 * 60 * 60 * 1000);

console.log("hold tests ok");
