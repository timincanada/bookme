import assert from "node:assert/strict";
import {
  BOOKING_HOST,
  brandedBookingUrl,
  brandedManageUrl,
  bookingPath,
  displayBookingLink,
  displayManageLink,
  isReservedSlug,
} from "./booking-link.ts";

assert.equal(bookingPath("alex"), "/alex");
assert.equal(bookingPath("/alex"), "/alex");
assert.equal(displayBookingLink("alex"), "bookme.training/alex");
assert.equal(brandedBookingUrl("alex"), "https://bookme.training/alex");
assert.equal(BOOKING_HOST, "bookme.training");
assert.equal(isReservedSlug("app"), true);
assert.equal(isReservedSlug("login"), true);
assert.equal(isReservedSlug("manage"), true);
assert.equal(isReservedSlug("preview"), true);
assert.equal(isReservedSlug("alex"), false);
assert.equal(isReservedSlug("alex-rivera"), false);
assert.ok(displayBookingLink("alex").length < 24);
assert.equal(displayManageLink(), "bookme.training/manage");
assert.equal(brandedManageUrl(), "https://bookme.training/manage");

console.log("booking-link tests ok");
