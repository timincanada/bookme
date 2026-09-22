import assert from "node:assert/strict";
import {
  addDaysKey,
  addMonthsKey,
  dateKeyAt,
  datesFromToday,
  daysBetweenKeys,
  formatClockMinutes,
  formatDateKey,
  formatTime,
  formatWhen,
  isDateKey,
  mondayOfKey,
  todayKey,
  weekdayOf,
  zonedInstant,
  zonedInstantExact,
  formatWeekRange,
  monthGrid,
  pad,
  shiftMonth,
  minutesAt,
  weekKeys,
  weekStartKey,
} from "./time.ts";

const aug = monthGrid(2026, 8);
assert.equal(aug[0], null); // Sat 1st 2026 → 6 leading pads? Aug 1 2026 is Saturday.
assert.equal(new Date("2026-08-01T12:00:00").getDay(), 6);
assert.equal(aug.filter((c) => c === null).length, 6);
assert.equal(aug.filter(Boolean).length, 31);
assert.equal(aug[6], "2026-08-01");
assert.equal(aug.at(-1), "2026-08-31");

const next = shiftMonth(2026, 12, 1);
assert.deepEqual(next, { year: 2027, month: 1 });
assert.equal(pad(3), "03");

// 2026-08-24T21:00:00.000Z is 5:00 p.m. Eastern (EDT, UTC-4), not 9:00 p.m. local/UTC.
const slot = new Date("2026-08-24T21:00:00.000Z");
const TOR = "America/Toronto";
const VAN = "America/Vancouver";
assert.match(formatTime(slot, TOR), /5:00/);
assert.match(formatWhen(slot, TOR), /5:00/);
assert.doesNotMatch(formatTime(slot, TOR), /9:00/);
assert.equal(minutesAt(slot, TOR), 17 * 60);
// Same instant in a coach's Pacific zone.
assert.match(formatTime(slot, VAN), /2:00/);
assert.equal(minutesAt(slot, VAN), 14 * 60);
assert.equal(dateKeyAt(new Date("2026-09-23T03:30:00Z"), TOR), "2026-09-22");
assert.equal(dateKeyAt(new Date("2026-09-23T03:30:00Z"), "UTC"), "2026-09-23");

// Wall time → instant, per zone, across DST.
assert.equal(zonedInstantExact("2026-09-22", 960, TOR)!.toISOString(), "2026-09-22T20:00:00.000Z");
assert.equal(zonedInstantExact("2026-09-22", 960, VAN)!.toISOString(), "2026-09-22T23:00:00.000Z");
assert.equal(zonedInstantExact("2026-12-22", 960, TOR)!.toISOString(), "2026-12-22T21:00:00.000Z");
assert.equal(zonedInstantExact("2027-03-14", 150, TOR), null, "spring-forward gap");
assert.equal(zonedInstant("2027-03-14", 150, TOR).toISOString(), "2027-03-14T07:30:00.000Z");
assert.equal(zonedInstantExact("2026-11-01", 90, TOR)!.toISOString(), "2026-11-01T05:30:00.000Z", "fall-back: earlier instant");
assert.equal(zonedInstantExact("2026-09-22", 0, "Asia/Kolkata")!.toISOString(), "2026-09-21T18:30:00.000Z");
assert.equal(todayKey(TOR, new Date("2026-09-17T02:00:00Z")), "2026-09-16");

// Pure date keys
assert.equal(weekdayOf("2026-09-22"), 2);
assert.equal(addDaysKey("2026-10-31", 1), "2026-11-01");
assert.equal(addDaysKey("2027-03-13", 1), "2027-03-14");
assert.equal(addMonthsKey("2027-03-31", 6), "2027-09-30");
assert.equal(addMonthsKey("2026-08-31", 6), "2027-02-28");
assert.equal(addMonthsKey("2027-08-31", 6), "2028-02-29");
assert.equal(addMonthsKey("2026-11-15", 2), "2027-01-15");
assert.equal(mondayOfKey("2026-09-27"), "2026-09-21");
assert.equal(mondayOfKey("2026-09-21"), "2026-09-21");
assert.equal(daysBetweenKeys("2026-09-21", "2026-10-05"), 14);
assert.equal(isDateKey("2026-02-29"), false);
assert.equal(isDateKey("2028-02-29"), true);
assert.equal(formatDateKey("2026-09-22"), "Tue, Sep 22");
assert.equal(formatClockMinutes(960), "4:00 p.m.");
assert.deepEqual(datesFromToday(2, TOR).length, 2);

// 2026-09-14 is a Monday → week starts Sunday 13th.
assert.equal(weekStartKey("2026-09-14"), "2026-09-13");
assert.deepEqual(weekKeys("2026-09-14"), [
  "2026-09-13",
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
]);
assert.equal(formatWeekRange(weekKeys("2026-09-14")), "Sep 13 – 19");

console.log("time tests ok");
