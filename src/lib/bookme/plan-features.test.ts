import assert from "node:assert/strict";
import {
  ASSISTANT_FEATURES,
  ASSISTANT_UPGRADE,
  CORE_FEATURES,
  planFeatureCard,
} from "./plan-features.ts";

assert.ok(CORE_FEATURES.length >= 5 && CORE_FEATURES.length <= 7);
assert.ok(ASSISTANT_FEATURES.length >= 5);

const light = planFeatureCard("light");
const coach = planFeatureCard("coach");
const busy = planFeatureCard("busy");

assert.equal(light.groups[0]?.title, "Included");
assert.deepEqual(
  light.groups[0]?.lines.map((line) => line.text),
  [...CORE_FEATURES],
);
assert.ok(light.groups[0]?.lines.every((line) => line.tone === "included"));
assert.equal(light.groups[1]?.title, "Private Assistant");
assert.deepEqual(
  light.groups[1]?.lines.map((line) => line.text),
  [...ASSISTANT_FEATURES],
);
assert.ok(light.groups[1]?.lines.every((line) => line.tone === "excluded"));
assert.equal(light.upgrade, ASSISTANT_UPGRADE);
assert.match(light.summary, /not included/i);
assert.match(light.summary, /Upgrade to Coach/);

assert.equal(coach.groups[0]?.title, "Private Assistant");
assert.equal(busy.groups[0]?.title, "Private Assistant");
assert.deepEqual(
  coach.groups[0]?.lines.map((line) => [line.text, line.tone]),
  ASSISTANT_FEATURES.map((text) => [text, "included"]),
);
assert.deepEqual(busy.groups[0]?.lines, coach.groups[0]?.lines);
assert.deepEqual(
  coach.groups[1]?.lines.map((line) => line.text),
  ["Everything in Light"],
);
assert.deepEqual(
  busy.groups[1]?.lines.map((line) => line.text),
  ["Everything in Coach"],
);
assert.equal(coach.summary, busy.summary);
assert.match(coach.summary, /included/i);
assert.match(coach.summary, /confirm/i);
assert.equal(coach.upgrade, undefined);
assert.equal(busy.upgrade, undefined);

const assistantText = ASSISTANT_FEATURES.join("\n");
assert.match(assistantText, /voice and text/i);
assert.match(assistantText, /emails to students/i);
assert.match(assistantText, /Reschedules lessons and emails the student/);
assert.match(assistantText, /Proposes time swaps between two students/);
assert.match(assistantText, /Cancels lessons \(you confirm first\)/);
assert.match(assistantText, /confirm before sending or changing/i);

const forbidden = [
  /multiple locations/i,
  /next-week/i,
  /in-app message/i,
  /approve/i,
  /decline/i,
  /book a /i,
  /new lesson/i,
  /for full calendars/i,
  /apple wallet/i,
];
for (const pattern of forbidden) {
  assert.equal(pattern.test(assistantText), false, String(pattern));
}

assert.match(CORE_FEATURES.join("\n"), /multiple locations/i);
assert.match(CORE_FEATURES.join("\n"), /next-week booking/i);
assert.match(CORE_FEATURES.join("\n"), /in-app messages/i);
assert.equal(/CA\$/.test([...CORE_FEATURES, ...ASSISTANT_FEATURES].join(" ")), false);

const busyOnly = busy.groups
  .flatMap((group) => group.lines.map((line) => line.text))
  .filter((text) => !coach.groups.flatMap((group) => group.lines.map((line) => line.text)).includes(text));
assert.deepEqual(busyOnly, ["Everything in Coach"]);

console.log("plan-features.test.ts ok");
