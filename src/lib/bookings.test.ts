import assert from "node:assert/strict";
import { bookingBucket, payLabel, lessonStatusLabel } from "./bookings";

const now = new Date("2026-08-22T16:00:00Z");
const future = new Date("2026-08-23T16:00:00Z");
const past = new Date("2026-08-21T16:00:00Z");

assert.equal(bookingBucket("confirmed", future, now), "upcoming");
assert.equal(bookingBucket("held", future, now), "upcoming");
assert.equal(bookingBucket("confirmed", past, now), "completed");
assert.equal(bookingBucket("cancelled", future, now), "cancelled");
assert.equal(bookingBucket("expired", future, now), "cancelled");
assert.equal(bookingBucket("held", past, now), "upcoming");

assert.equal(payLabel("paid", "card").text, "Paid");
assert.equal(payLabel("marked_offline", "cash").text, "Collected offline");
assert.equal(payLabel("unpaid", "cash").text, "Unpaid");
assert.equal(payLabel("unpaid", "card").text, "Unpaid");
assert.equal(payLabel("unpaid", "card").kind, "unpaid");
assert.equal(lessonStatusLabel("confirmed"), "Confirmed");
assert.equal(payLabel("refunded", "card").text, "Refunded");

console.log("bookings tests ok");
