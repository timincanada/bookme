import assert from "node:assert/strict";
import { canAcceptNewBookings, lastMonthRange, planForConfirmedCount, PLANS, TRIAL_DAYS } from "./subscription";

assert.equal(TRIAL_DAYS, 3);
assert.equal(PLANS.light.cad, 19);
assert.equal(PLANS.coach.cad, 29);
assert.equal(PLANS.busy.cad, 49);
assert.equal(planForConfirmedCount(0), "light");
assert.equal(planForConfirmedCount(20), "light");
assert.equal(planForConfirmedCount(21), "coach");
assert.equal(planForConfirmedCount(60), "coach");
assert.equal(planForConfirmedCount(61), "busy");
assert.equal(canAcceptNewBookings("trialing"), true);
assert.equal(canAcceptNewBookings("canceled"), false);
const { start, end } = lastMonthRange(new Date("2026-08-22T12:00:00Z"));
assert.equal(start.toISOString(), "2026-07-01T00:00:00.000Z");
assert.equal(end.toISOString(), "2026-08-01T00:00:00.000Z");
console.log("subscription tests ok");
