import assert from "node:assert/strict";
import {
  assistantVisibleText,
  openingGroupView,
  openingsAreStructured,
  slotSelectionPhrase,
} from "./opening-slots.ts";

const structured = openingGroupView({
  label: "Mon, Sep 14",
  times: ["10:00 a.m.", "11:00 a.m."],
  location: "Court 1",
  lines: ["10:00 a.m. · Court 1", "11:00 a.m. · Somewhere else"],
});
assert.deepEqual(structured.times, ["10:00 a.m.", "11:00 a.m."]);
assert.equal(structured.location, "Court 1");

const legacy = openingGroupView({
  label: "Tue, Sep 15",
  lines: ["9:00 a.m. · Park", "10:00 a.m. · Park"],
});
assert.deepEqual(legacy.times, ["9:00 a.m.", "10:00 a.m."]);
assert.equal(legacy.location, "Park");

const mixed = openingGroupView({
  label: "Wed, Sep 16",
  lines: ["9:00 a.m. · Park", "10:00 a.m. · Club"],
});
assert.deepEqual(mixed.times, ["9:00 a.m.", "10:00 a.m."]);
assert.equal(mixed.location, "");

assert.equal(openingsAreStructured([{ label: "Thu", lines: ["1:00 p.m."] }]), true);
assert.equal(openingsAreStructured([{ label: "Thu", lines: [] }]), false);

const blob = "Mon, Sep 14: 10:00 a.m. · Court 1, 11:00 a.m. · Court 1";
assert.equal(
  assistantVisibleText(blob, {
    kind: "openings",
    groups: [{ label: "Mon, Sep 14", times: ["10:00 a.m."], location: "Court 1", lines: ["10:00 a.m. · Court 1"] }],
  }),
  "Here are some available times.",
);
assert.equal(
  assistantVisibleText(blob, {
    kind: "openings",
    groups: [{ label: "Mon, Sep 14", lines: ["10:00 a.m. · Court 1"] }],
  }),
  "Here are some available times.",
);
assert.equal(assistantVisibleText("Moved.", { kind: "schedule", groups: [] }), "Moved.");
assert.equal(slotSelectionPhrase("Mon, Sep 14", "10:00 a.m."), "10:00 a.m. on Mon, Sep 14");

console.log("opening-slots.test.ts ok");
