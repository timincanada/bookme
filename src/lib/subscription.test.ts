import assert from "node:assert/strict";
import { canAcceptNewBookings, COACH_PLAN_CAD, TRIAL_DAYS } from "./subscription";

assert.equal(COACH_PLAN_CAD, 29);
assert.equal(TRIAL_DAYS, 3);
assert.equal(canAcceptNewBookings("trialing"), true);
assert.equal(canAcceptNewBookings("active"), true);
assert.equal(canAcceptNewBookings("none"), false);
assert.equal(canAcceptNewBookings("canceled"), false);
assert.equal(canAcceptNewBookings("past_due"), false);
assert.equal(canAcceptNewBookings(undefined), false);
console.log("subscription tests ok");
