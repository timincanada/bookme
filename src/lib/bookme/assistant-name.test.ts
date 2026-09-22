import assert from "node:assert/strict";
import { ASSISTANT_NAME_MAX, DEFAULT_ASSISTANT_NAME, assistantDeskTitle, normalizeAssistantName } from "./assistant-name.ts";

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

assert.equal(assistantDeskTitle("Alex Rivera"), "Alex Rivera's private assistant");
assert.equal(assistantDeskTitle("James"), "James's private assistant");
assert.equal(assistantDeskTitle("  Tim Zhang  "), "Tim Zhang's private assistant");
assert.equal(assistantDeskTitle(""), "BookMe Assistant");
assert.equal(assistantDeskTitle("   "), "BookMe Assistant");

