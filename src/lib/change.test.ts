import assert from "node:assert/strict";
import { WEEK_MS, coachCancelRefundsCard, nextWeekStart } from "./change";
import { statusAfterReschedule } from "./hold";

const start = new Date("2026-08-21T14:00:00Z");
assert.equal(nextWeekStart(start).getTime() - start.getTime(), WEEK_MS);
assert.equal(coachCancelRefundsCard("coach", false), true);
assert.equal(coachCancelRefundsCard("coach", true), true);
assert.equal(coachCancelRefundsCard("student", false), false);
assert.equal(coachCancelRefundsCard("student", true), true);
assert.equal(statusAfterReschedule("held"), "held");
assert.equal(statusAfterReschedule("confirmed"), "confirmed");

console.log("change tests ok");
