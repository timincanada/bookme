import assert from "node:assert/strict";
import {
  ASSISTANT_EXCLUDED,
  ASSISTANT_FEATURES,
  ASSISTANT_LEAD,
  ASSISTANT_NOTE,
  ASSISTANT_UPGRADE,
  CORE_FEATURES,
  planFeatureCard,
} from "./plan-features.ts";

assert.ok(CORE_FEATURES.length >= 5 && CORE_FEATURES.length <= 6);
assert.ok(ASSISTANT_FEATURES.length >= 5 && ASSISTANT_FEATURES.length <= 6);
assert.ok(ASSISTANT_EXCLUDED.length >= 1 && ASSISTANT_EXCLUDED.length <= 3);

const light = planFeatureCard("light");
const coach = planFeatureCard("coach");
const busy = planFeatureCard("busy");

assert.equal(light.groups[0]?.title, undefined);
assert.deepEqual(
  light.groups[0]?.lines.map((line) => line.text),
  [...CORE_FEATURES],
);
assert.ok(light.groups[0]?.lines.every((line) => line.tone === "included"));
assert.equal(light.groups[0]?.note, undefined);

assert.equal(light.groups[1]?.title, "Private Assistant");
assert.deepEqual(
  light.groups[1]?.lines.map((line) => line.text),
  [...ASSISTANT_EXCLUDED],
);
assert.ok(light.groups[1]?.lines.every((line) => line.tone === "excluded"));
assert.equal(light.groups[1]?.note, undefined);
assert.equal(light.upgrade, ASSISTANT_UPGRADE);
assert.match(light.summary, /not included/i);
assert.match(light.summary, /Upgrade to Coach/);

assert.equal(coach.groups[0]?.title, ASSISTANT_LEAD);
assert.equal(busy.groups[0]?.title, ASSISTANT_LEAD);
assert.equal(ASSISTANT_LEAD, "A dedicated Private Assistant you can name");
assert.deepEqual(
  coach.groups[0]?.lines.map((line) => [line.text, line.tone]),
  ASSISTANT_FEATURES.map((text) => [text, "included"]),
);
assert.deepEqual(busy.groups[0]?.lines, coach.groups[0]?.lines);
assert.equal(coach.groups[0]?.note, ASSISTANT_NOTE);
assert.equal(busy.groups[0]?.note, ASSISTANT_NOTE);
assert.equal(ASSISTANT_NOTE, "You confirm before anything is sent or changed");
assert.equal(
  [...ASSISTANT_FEATURES].some((text) => /confirm before/i.test(text)),
  false,
);

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
assert.match(coach.summary, /both students must accept/i);
assert.match(coach.summary, /emailed/i);
assert.equal(coach.upgrade, undefined);
assert.equal(busy.upgrade, undefined);

const assistantText = ASSISTANT_FEATURES.join("\n");
assert.match(assistantText, /voice and text/i);
assert.match(assistantText, /openings/i);
assert.match(assistantText, /your schedule/i);
assert.match(assistantText, /Emails students for you/);
assert.match(assistantText, /Reschedules and cancels lessons, and emails the student/);
assert.match(assistantText, /Proposes time swaps between students \(both must accept\)/);
assert.match(assistantText, /Blocks off hours and sets up recurring lessons/);

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
  assert.equal(pattern.test(ASSISTANT_EXCLUDED.join("\n")), false, String(pattern));
}

const coreText = CORE_FEATURES.join("\n");
assert.match(coreText, /Booking page, schedule and requests/);
assert.match(coreText, /Weekly hours and real open slots/);
assert.match(coreText, /Reschedules, swaps and recurring lessons/);
assert.match(coreText, /Client records and messages/);
assert.match(coreText, /Payment tracking and email reminders/);
assert.match(coreText, /Weather alerts/);
assert.equal(/private assistant/i.test(coreText), false);
assert.equal(/CA\$/.test([...CORE_FEATURES, ...ASSISTANT_FEATURES, ...ASSISTANT_EXCLUDED, ASSISTANT_NOTE].join(" ")), false);

const coachLines = coach.groups.flatMap((group) => group.lines.map((line) => line.text));
const busyOnly = busy.groups
  .flatMap((group) => group.lines.map((line) => line.text))
  .filter((text) => !coachLines.includes(text));
assert.deepEqual(busyOnly, ["Everything in Coach"]);

console.log("plan-features.test.ts ok");
