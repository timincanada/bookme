import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterClients, sortClients } from "./client-sort.ts";
import { hideQaRecords, isProductionQaRecord } from "./qa-surface.ts";
import { BOOKING_TAB_IDS, HSCROLL } from "./ui-classes.ts";

const rows = [
  { name: "Sam", email: "sam@example.com", n: 1, last_at: "2026-09-01T15:00:00Z" },
  { name: "amy", email: "amy@example.com", n: 4, last_at: "2026-08-01T15:00:00Z" },
  { name: "Bea", email: "bea@example.com", n: 4, last_at: null },
];

assert.deepEqual(
  sortClients(rows, "az").map((c) => c.name),
  ["amy", "Bea", "Sam"],
);
assert.deepEqual(
  sortClients(rows, "booked").map((c) => c.name),
  ["amy", "Bea", "Sam"],
);
assert.deepEqual(
  sortClients(rows, "recent").map((c) => c.name),
  ["Sam", "amy", "Bea"],
);
assert.deepEqual(
  filterClients(rows, "AMY").map((c) => c.email),
  ["amy@example.com"],
);

assert.equal(isProductionQaRecord({ email: "coach@bookme.test", name: "Alex" }), true);
assert.equal(isProductionQaRecord({ email: "a@example.invalid", name: "Alex" }), true);
assert.equal(isProductionQaRecord({ email: "a@mail.tm", name: "Alex" }), true);
assert.equal(isProductionQaRecord({ email: "real@club.com", name: "Riley QA Weather" }), true);
assert.equal(isProductionQaRecord({ email: "real@club.com", name: "Emma Chen" }), false);
assert.equal(isProductionQaRecord({ email: "emma@example.com", name: "Emma Chen" }), false);

const mixed = [
  { name: "Emma Chen", email: "emma@example.com" },
  { name: "BookMe QA", email: "qa@example.com" },
  { clientName: "Jordan Lee", clientEmail: "jordan@bookme.test" },
];
assert.equal(hideQaRecords(mixed, true).length, 3);
assert.deepEqual(
  hideQaRecords(mixed, false).map((row) => ("name" in row ? row.name : row.clientName)),
  ["Emma Chen"],
);

assert.deepEqual([...BOOKING_TAB_IDS], ["upcoming", "requests", "completed", "cancelled"]);
assert.match(HSCROLL, /\bflex-nowrap\b/);
assert.match(HSCROLL, /overflow-x-auto/);
assert.match(HSCROLL, /min-w-0/);
assert.equal(/\bflex-wrap\b/.test(HSCROLL), false);

const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
for (const token of [
  "100dvh",
  "safe-area-inset-bottom",
  "scrollbar-width: none",
  ".hscroll",
  "--nav-height",
  "--touch-min",
  "--composer-height",
  "--radius-card",
]) {
  assert.equal(css.includes(token), true, token);
}

const root = readFileSync(new URL("../../routes/__root.tsx", import.meta.url), "utf8");
assert.match(root, /viewport-fit=cover/);
assert.match(root, /interactive-widget=resizes-content/);

console.log("ui-polish.test.ts ok");
