import assert from "node:assert/strict";
import {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  listIanaTimezones,
  nextHighlightIndex,
  searchTimezones,
  timezoneFriendlyName,
} from "./timezone.ts";

assert.equal(DEFAULT_TIMEZONE, "America/Toronto");
assert.equal(isValidTimezone("America/Toronto"), true);
assert.equal(isValidTimezone("America/Vancouver"), true);
assert.equal(isValidTimezone("Not/AZone"), false);
assert.equal(isValidTimezone(""), false);
assert.equal(isValidTimezone(null), false);
assert.equal(isValidTimezone("Europe/London"), true);

const zones = listIanaTimezones();
assert.ok(zones.includes("America/Toronto"));
assert.ok(zones.length > 50);

const tor = searchTimezones("tor");
assert.ok(tor.some((z) => z.includes("Toronto")));
assert.equal(timezoneFriendlyName("America/Toronto"), "Eastern Time");
assert.equal(nextHighlightIndex(-1, 0, 1), -1);
assert.equal(nextHighlightIndex(-1, 4, 1), 0);
assert.equal(nextHighlightIndex(-1, 4, -1), 3);
assert.equal(nextHighlightIndex(0, 4, -1), 3);
assert.equal(nextHighlightIndex(3, 4, 1), 0);
assert.equal(nextHighlightIndex(1, 4, 1), 2);

console.log("timezone tests ok");
