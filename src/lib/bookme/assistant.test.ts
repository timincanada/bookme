import assert from "node:assert/strict";
import { dateKeyFromText, findClient, parseAssistant, shiftDateKey, signEmailAsCoach } from "./assistant.ts";

const clients = [{ id: "c1", name: "Emma Chen" }, { id: "c2", name: "Alex" }];
const lessons = [
  { id: "l1", clientId: "c1", clientName: "Emma Chen", startAt: "2026-09-24T21:00:00.000Z", status: "confirmed", location: "Court 3" },
  { id: "l2", clientId: "c2", clientName: "Alex", startAt: "2026-09-25T19:00:00.000Z", status: "confirmed", location: "Blackmore" },
];
const ctx = { todayKey: "2026-09-22", timezone: "America/Toronto", clients, lessons };

assert.equal(shiftDateKey("2026-09-22", 1), "2026-09-23");
assert.equal(findClient(clients, "email Alex")?.id, "c2");

const list = parseAssistant("Openings this week", ctx);
assert.equal(list.ok, true);
if (list.ok) {
  assert.equal(list.needsConfirm, false);
  assert.equal(list.action.type, "list_availability");
  if (list.action.type === "list_availability") assert.equal(list.action.days, 7);
}

const msg = parseAssistant("Email Alex about Tuesday", ctx);
assert.equal(msg.ok, true);
if (msg.ok) {
  assert.equal(msg.needsConfirm, true);
  assert.equal(msg.action.type, "draft_email");
  if (msg.action.type === "draft_email") assert.equal(msg.action.lessonId, "l2");
}

const block = parseAssistant("Block Thursday afternoon", ctx);
assert.equal(block.ok, true);
if (block.ok) {
  assert.equal(block.needsConfirm, true);
  assert.equal(block.action.type, "draft_reschedule");
  if (block.action.type === "draft_reschedule") {
    assert.equal(block.action.op, "block");
    assert.equal(block.action.startMin, 12 * 60);
  }
}

const swap = parseAssistant("Swap Emma and Alex because of a tournament", ctx);
assert.equal(swap.ok, true);
if (swap.ok) {
  assert.equal(swap.needsConfirm, true);
  assert.equal(swap.action.type, "draft_swap");
  if (swap.action.type === "draft_swap") {
    assert.equal(swap.action.lessonAId, "l1");
    assert.equal(swap.action.lessonBId, "l2");
    assert.match(swap.action.note, /tournament/i);
  }
}

const swapZh = parseAssistant("对调 Emma 和 Alex 球场冲突", ctx);
assert.equal(swapZh.ok, true);
if (swapZh.ok) {
  assert.equal(swapZh.action.type, "draft_swap");
}

const hours = parseAssistant("Change hours", ctx);
assert.equal(hours.ok, false);

const cancel = parseAssistant("cancel Emma", ctx);
assert.equal(cancel.ok, true);
if (cancel.ok) {
  assert.equal(cancel.action.type, "cancel_lesson");
  if (cancel.action.type === "cancel_lesson") assert.equal(cancel.action.lessonId, "l1");
}

const sched = parseAssistant("show me all the existing schedule", ctx);
assert.equal(sched.ok, true);
if (sched.ok) assert.equal(sched.action.type, "list_lessons");

const unclear = parseAssistant("what should I do", ctx);
assert.equal(unclear.ok, true);
if (unclear.ok) assert.equal(unclear.action.type, "list_lessons");

const signed = signEmailAsCoach("Hi Jordan,\n\nI need to cancel Monday.\n\nThanks,\nMaya", "Alex Rivera", "Maya");
assert.match(signed, /Alex Rivera/);
assert.equal(/Maya\s*$/.test(signed), false);
assert.match(signed, /Thanks,\nAlex Rivera/);

console.log("assistant tests ok");
