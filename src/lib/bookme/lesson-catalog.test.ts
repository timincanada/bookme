import assert from "node:assert/strict";
import { lessonCatalogLines, lessonDisplayName, lessonDurationPriceLine } from "./lesson-catalog.ts";

assert.equal(lessonDisplayName(""), "Lesson");
assert.equal(lessonDisplayName("   "), "Lesson");
assert.equal(lessonDisplayName(null), "Lesson");
assert.equal(lessonDisplayName("Private tennis"), "Private tennis");

const single = lessonDurationPriceLine(30, 80);
assert.match(single, /^30 min · /);
assert.match(single, /80/);
assert.doesNotMatch(single, /\.00/);

const view = lessonCatalogLines({
  name: "  ",
  duration: 60,
  durations: [60, 30],
  priceCad: 85,
});
assert.equal(view.name, "Lesson");
assert.equal(view.lines.length, 2);
assert.match(view.lines[0], /^30 min · /);
assert.match(view.lines[1], /^60 min · /);
assert.match(view.lines[0], /85/);
assert.match(view.lines[1], /85/);

const named = lessonCatalogLines({ name: "Hitting Clinic", duration: 60, durations: [60], priceCad: 45 });
assert.equal(named.name, "Hitting Clinic");
assert.match(named.lines[0], /^60 min · /);
assert.match(named.lines[0], /45/);

const split = lessonCatalogLines({
  name: "Private",
  duration: 30,
  durations: [30, 60],
  priceCad: 55,
  durationPrices: { "30": 55, "60": 85 },
});
assert.match(split.lines[0], /^30 min · /);
assert.match(split.lines[0], /55/);
assert.doesNotMatch(split.lines[0], /85/);
assert.match(split.lines[1], /^60 min · /);
assert.match(split.lines[1], /85/);

console.log("lesson-catalog tests ok");
