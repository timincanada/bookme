import assert from "node:assert/strict";
import {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  listIanaTimezones,
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

console.log("timezone tests ok");
