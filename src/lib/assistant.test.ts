import assert from "node:assert/strict";
import { dateKeyFromText, findClient, parseAssistant, shiftDateKey } from "./assistant";

const clients = [{ id: "c1", name: "Emma Chen" }, { id: "c2", name: "Alex" }];
const lessons = [
  { id: "l1", clientId: "c1", clientName: "Emma Chen", startAt: "2026-08-24T21:00:00.000Z", status: "confirmed", location: "Court 3" },
  { id: "l2", clientId: "c2", clientName: "Alex", startAt: "2026-08-25T19:00:00.000Z", status: "confirmed", location: "Blackmore" },
];
const ctx = { todayKey: "2026-08-22", clients, lessons };

assert.equal(shiftDateKey("2026-08-22", 1), "2026-08-23");
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

const hours = parseAssistant("Change hours", ctx);
assert.equal(hours.ok, false);

console.log("assistant tests ok");
