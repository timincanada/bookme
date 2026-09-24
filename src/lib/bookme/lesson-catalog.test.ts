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

console.log("lesson-catalog tests ok");
