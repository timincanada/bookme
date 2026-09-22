import assert from "node:assert/strict";
import {
  DEFAULT_BOOK_AHEAD_DAYS,
  bookAheadLabel,
  isWithinBookAhead,
  lastBookableDateKey,
  normalizeBookAheadDays,
} from "./book-ahead.ts";

assert.equal(DEFAULT_BOOK_AHEAD_DAYS, 28);
assert.equal(normalizeBookAheadDays(7), 7);
assert.equal(normalizeBookAheadDays(14), 14);
assert.equal(normalizeBookAheadDays(28), 28);
assert.equal(normalizeBookAheadDays(99), 28);
assert.equal(normalizeBookAheadDays(undefined), 28);
assert.equal(normalizeBookAheadDays("14"), 14);

const today = "2026-09-14";
assert.equal(lastBookableDateKey(7, today), "2026-09-20");
assert.equal(lastBookableDateKey(14, today), "2026-09-27");
assert.equal(lastBookableDateKey(28, today), "2026-10-11");
assert.equal(isWithinBookAhead("2026-09-14", 7, today), true);
assert.equal(isWithinBookAhead("2026-09-20", 7, today), true);
assert.equal(isWithinBookAhead("2026-09-21", 7, today), false);
assert.equal(isWithinBookAhead("2026-10-11", 28, today), true);
assert.equal(isWithinBookAhead("2026-10-12", 28, today), false);
assert.equal(isWithinBookAhead("2026-09-13", 7, today), false);
assert.equal(bookAheadLabel(14), "2 weeks");

console.log("book-ahead tests ok");
