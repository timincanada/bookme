import assert from "node:assert/strict";
import { canCopyBookingLink, isSetupComplete, slugify, VERTICALS } from "./setup";

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
