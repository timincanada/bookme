import assert from "node:assert/strict";
import { afterPartyDecision, clipNote, firstName, swapPlan, viewerRequestView } from "./requests.ts";

assert.equal(firstName("Emma Chen"), "Emma");
assert.equal(firstName("  Jordan  "), "Jordan");
assert.equal(clipNote("  please  swap  "), "please swap");
assert.equal(clipNote("x".repeat(500)).length, 400);

const a = { duration: 60, start: new Date("2026-09-21T14:00:00.000Z") };
const b = { duration: 60, start: new Date("2026-09-22T20:00:00.000Z") };
const plan = swapPlan(a, b);
assert.equal(plan.ok, true);
if (plan.ok) {
  assert.equal(plan.aEnd.toISOString(), "2026-09-22T21:00:00.000Z");
  assert.equal(plan.bEnd.toISOString(), "2026-09-21T15:00:00.000Z");
}
assert.equal(swapPlan(a, { ...b, duration: 45 }).ok, false);
assert.equal(swapPlan(a, a).ok, false);

assert.equal(afterPartyDecision("accepted", "pending"), "pending");
assert.equal(afterPartyDecision("accepted", "accepted"), "accepted");
assert.equal(afterPartyDecision("declined", "accepted"), "declined");

const swap = viewerRequestView({
  viewerEmail: "jordan@bookme.test",
  primaryEmail: "Emma@BookMe.test",
  primaryWhen: "Mon 10:00",
  primaryLessonId: "l1",
  otherEmail: "jordan@bookme.test",
  otherWhen: "Tue 4:00",
  otherLessonId: "l2",
  kind: "coach_swap",
  status: "pending",
  studentDecision: "accepted",
  otherDecision: "pending",
  studentToken: "tok-a",
  otherToken: "tok-b",
});
assert.equal(swap.isPrimary, false);
assert.equal(swap.yourWhen, "Tue 4:00");
assert.equal(swap.otherWhen, "Mon 10:00");
assert.equal(swap.otherLabel, "Another student");
assert.ok(!JSON.stringify(swap).includes("Emma"), "no other student's name");
const primaryView = viewerRequestView({
  viewerEmail: "EMMA@bookme.test",
  primaryEmail: "emma@bookme.test",
  primaryWhen: "Mon 10:00",
  primaryLessonId: "l1",
  otherEmail: "jordan@bookme.test",
  otherWhen: "Tue 4:00",
  otherLessonId: "l2",
  kind: "coach_swap",
  status: "pending",
  studentDecision: "pending",
  otherDecision: "pending",
  studentToken: "tok-a",
  otherToken: "tok-b",
});
assert.equal(primaryView.isPrimary, true, "case-insensitive viewer match");
assert.equal(primaryView.token, "tok-a");
assert.equal(swap.lessonId, "l2");
assert.equal(swap.canDecide, true);
assert.equal(swap.token, "tok-b");

const move = viewerRequestView({
  viewerEmail: "emma@bookme.test",
  primaryEmail: "emma@bookme.test",
  primaryWhen: "Mon 10:00",
  primaryLessonId: "l1",
  kind: "student_move",
  status: "pending",
  studentDecision: "accepted",
});
assert.equal(move.canDecide, false);
assert.equal(move.yourWhen, "Mon 10:00");
assert.equal(move.otherWhen, null);

console.log("requests tests ok");
