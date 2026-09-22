import assert from "node:assert/strict";
import {
  ASSISTANT_NAME_MAX,
  DEFAULT_ASSISTANT_NAME,
  assistantDeskTitle,
  hasCustomAssistantName,
  normalizeAssistantName,
} from "./assistant-name.ts";

assert.equal(DEFAULT_ASSISTANT_NAME, "Assistant");
assert.equal(ASSISTANT_NAME_MAX, 24);
assert.equal(normalizeAssistantName(""), "Assistant");
assert.equal(normalizeAssistantName("   "), "Assistant");
assert.equal(normalizeAssistantName(undefined), "Assistant");
assert.equal(normalizeAssistantName("  Maya  "), "Maya");
assert.equal(normalizeAssistantName("Desk\nfront"), "Desk front");
assert.equal(normalizeAssistantName("前台小助"), "前台小助");
assert.equal(normalizeAssistantName("A very long assistant nickname here").length, 24);
assert.equal(normalizeAssistantName("Alex's desk"), "Alex's desk");

assert.equal(hasCustomAssistantName(""), false);
assert.equal(hasCustomAssistantName("Assistant"), false);
assert.equal(hasCustomAssistantName("  Assistant  "), false);
assert.equal(hasCustomAssistantName("Lucy"), true);
assert.equal(hasCustomAssistantName("lucy"), true);

assert.equal(assistantDeskTitle("Alex Rivera"), "Alex Rivera's Private Assistant");
assert.equal(assistantDeskTitle("Alex Rivera", null), "Alex Rivera's Private Assistant");
assert.equal(assistantDeskTitle("Alex Rivera", "Assistant"), "Alex Rivera's Private Assistant");
assert.equal(assistantDeskTitle("Alex Rivera", "Lucy"), "Lucy-Alex Rivera's Private Assistant");
assert.equal(assistantDeskTitle("Alex Rivera", "  Lucy  "), "Lucy-Alex Rivera's Private Assistant");
assert.equal(assistantDeskTitle("James", "Maya"), "Maya-James's Private Assistant");
assert.equal(assistantDeskTitle("  Tim Zhang  ", "Desk"), "Desk-Tim Zhang's Private Assistant");
assert.equal(assistantDeskTitle(""), "BookMe Assistant");
assert.equal(assistantDeskTitle("   ", "Lucy"), "BookMe Assistant");

console.log("assistant-name.test.ts ok");
