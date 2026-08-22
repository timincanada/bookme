import assert from "node:assert/strict";
import { dateKeyFromText, findClient, parseAssistant, shiftDateKey } from "./assistant";

const clients = [{ id: "c1", name: "Emma Chen" }, { id: "c2", name: "Alex" }];
const lessons = [{ id: "l1", clientId: "c1", clientName: "Emma Chen", startAt: "2026-08-24T21:00:00.000Z", status: "confirmed" }];
const ctx = { todayKey: "2026-08-22", clients, lessons };

assert.equal(shiftDateKey("2026-08-22", 1), "2026-08-23");
assert.equal(dateKeyFromText("open times tomorrow", "2026-08-22"), "2026-08-23");
assert.equal(findClient(clients, "message Emma Chen")?.id, "c1");

const list = parseAssistant("what is open tomorrow", ctx);
assert.equal(list.ok, true);
if (list.ok) {
  assert.equal(list.needsConfirm, false);
  assert.equal(list.action.type, "list_availability");
  if (list.action.type === "list_availability") assert.equal(list.action.dateKey, "2026-08-23");
}

const msg = parseAssistant("message Emma Chen practice serve", ctx);
assert.equal(msg.ok, true);
if (msg.ok) {
  assert.equal(msg.needsConfirm, true);
  assert.equal(msg.action.type, "message_student");
  if (msg.action.type === "message_student") {
    assert.equal(msg.action.clientId, "c1");
    assert.match(msg.action.body, /practice serve/);
  }
}

const cancel = parseAssistant("cancel Emma", ctx);
assert.equal(cancel.ok, true);
if (cancel.ok) {
  assert.equal(cancel.needsConfirm, true);
  assert.equal(cancel.action.type, "mutate_schedule");
  if (cancel.action.type === "mutate_schedule") assert.equal(cancel.action.op, "cancel");
}

const light = parseAssistant("hello", ctx);
assert.equal(light.ok, false);

console.log("assistant tests ok");
