import assert from "node:assert/strict";
import { canCopyBookingLink, durationsFromService, isSetupComplete, normalizeServiceDurations, slugify, VERTICALS } from "./setup.ts";

assert.equal(VERTICALS.includes("Tennis"), true);
assert.equal(slugify("Tim Zhang"), "tim-zhang");
assert.equal(slugify("  "), "coach");

const ready = {
  title: "Tennis",
  timezone: "America/Toronto",
  service: { duration: 60, priceCad: 80 },
  locationCount: 1,
  hourCount: 5,
};
assert.equal(isSetupComplete(ready), true);
assert.equal(isSetupComplete({ ...ready, locationCount: 0 }), false);
assert.equal(isSetupComplete({ ...ready, hourCount: 0 }), false);
assert.equal(isSetupComplete({ ...ready, service: null }), false);
assert.equal(isSetupComplete({ ...ready, service: { duration: 60, priceCad: 80, durations: [30, 60, 90] } }), true);
assert.equal(isSetupComplete({ ...ready, service: { duration: 0, priceCad: 80, durations: [] } }), false);
assert.deepEqual(normalizeServiceDurations([90, 30, 30, 60]), [30, 60, 90]);
assert.equal(normalizeServiceDurations([]), null);
assert.deepEqual(durationsFromService({ duration: 45 }), [45]);
assert.deepEqual(durationsFromService({ duration: 60, durations: [120, 30] }), [30, 120]);


assert.equal(canCopyBookingLink(true, "trialing"), true);
assert.equal(canCopyBookingLink(true, "active"), true);
assert.equal(canCopyBookingLink(true, "none"), false);
assert.equal(canCopyBookingLink(false, "trialing"), false);
assert.equal(canCopyBookingLink(true, "canceled"), false);
assert.equal(canCopyBookingLink(true, "trialing", null, true), false);
assert.equal(canCopyBookingLink(true, "active", null, true), false);
assert.equal(canCopyBookingLink(true, "trialing", null, false), true);
assert.equal(canCopyBookingLink(true, "none", null, false, "paid"), true);
assert.equal(canCopyBookingLink(true, "trialing", null, false, "unpaid"), false);
assert.equal(canCopyBookingLink(true, "none", null, true, "paid"), false);

console.log("setup tests ok");
