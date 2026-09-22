import assert from "node:assert/strict";
import {
  conflictFor,
  detectLang,
  expandOccurrences,
  inRepeatWeek,
  isConfirmImportText,
  isOutsideHours,
  LESSON_DURATIONS,
  maxEndDate,
  normalizeRule,
  parseClock,
  recapImport,
  type RecurringPreview,
  type RecurringRuleInput,
} from "./recurring.ts";

const today = "2026-09-16"; // Wednesday
const base: RecurringRuleInput = {
  client: { kind: "existing", id: "c1" },
  slots: [{ weekday: 2, startMin: 16 * 60 }],
  startDate: "2026-09-16",
  endDate: "2026-12-31",
  intervalWeeks: 1,
};
const norm = (patch: Partial<RecurringRuleInput>, defaultDuration = 60) =>
  normalizeRule({ ...base, ...patch }, { today, defaultDuration });
const err = (patch: Partial<RecurringRuleInput>, re: RegExp, defaultDuration = 60) => {
  const r = norm(patch, defaultDuration);
  assert.equal(r.ok, false, `expected failure for ${JSON.stringify(patch)}`);
  if (!r.ok) assert.match(r.error, re);
};

// Durations: 30/45/60/90/120 only; default = current service.
assert.deepEqual([...LESSON_DURATIONS], [30, 45, 60, 90, 120]);
{
  const r = norm({ slots: [{ weekday: 2, startMin: 960 }, { weekday: 4, startMin: 1080, durationMin: 120 }] }, 45);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(
      r.rule.slots.map((s) => [s.weekday, s.startMin, s.durationMin, s.durationChanged]),
      [[2, 960, 45, false], [4, 1080, 120, true]],
    );
  }
}
err({ slots: [{ weekday: 2, startMin: 960, durationMin: 15 }] }, /30, 45, 60, 90 or 120/);
err({ slots: [{ weekday: 2, startMin: 960, durationMin: 150 }] }, /30, 45, 60, 90 or 120/);
err({ slots: [{ weekday: 2, startMin: 960, durationMin: 240 }] }, /30, 45, 60, 90 or 120/);
err({}, /lesson length/, 50);

// Several times a week, custom days, per-slot times.
{
  const r = norm({
    slots: [
      { weekday: 5, startMin: 17 * 60 },
      { weekday: 1, startMin: 9 * 60 },
      { weekday: 3, startMin: 9 * 60 },
    ],
  });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.rule.slots.map((s) => s.weekday), [1, 3, 5], "sorted Monday-first by weekday");
}
err({ slots: [] }, /at least one/);
err({ slots: Array.from({ length: 15 }, (_, i) => ({ weekday: i % 7, startMin: 360 + i * 60 })) }, /at most 14/);
assert.ok(norm({ slots: Array.from({ length: 14 }, (_, i) => ({ weekday: i % 7, startMin: 360 + i * 60 })) }).ok);
err({ slots: [{ weekday: 2, startMin: 960 }, { weekday: 2, startMin: 990 }] }, /overlap/);
assert.ok(norm({ slots: [{ weekday: 2, startMin: 960 }, { weekday: 2, startMin: 1020 }] }).ok, "back-to-back is fine");
err({ slots: [{ weekday: 2, startMin: 960 }, { weekday: 2, startMin: 960 }] }, /overlap/);
err({ slots: [{ weekday: 7, startMin: 960 }] }, /weekday/);
err({ slots: [{ weekday: 2, startMin: 1440 }] }, /start time/);
err({ slots: [{ weekday: 2, startMin: 23 * 60 + 30 }] }, /past midnight/);

// Dates: not in the past; end within 6 calendar months, inclusive.
err({ startDate: "2026-09-15" }, /past/);
assert.ok(norm({ startDate: today }).ok);
err({ startDate: "2026-10-01", endDate: "2026-09-30" }, /on or after/);
assert.equal(maxEndDate("2027-03-31"), "2027-09-30");
assert.equal(maxEndDate("2026-08-31"), "2027-02-28");
assert.equal(maxEndDate("2027-08-31"), "2028-02-29");
assert.ok(normalizeRule({ ...base, startDate: "2027-03-31", endDate: "2027-09-30" }, { today, defaultDuration: 60 }).ok);
{
  const r = normalizeRule({ ...base, startDate: "2027-03-31", endDate: "2027-10-01" }, { today, defaultDuration: 60 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /at most 6 months.*2027-09-30/);
}
assert.ok(norm({ startDate: "2026-09-16", endDate: "2027-03-16" }).ok);
err({ startDate: "2026-09-16", endDate: "2027-03-17" }, /6 months/);
err({ startDate: "2026-02-30" }, /start date/);
err({ intervalWeeks: 3 }, /every week or every 2 weeks/);

// Client
err({ client: { kind: "new", name: "  " } }, /name/);
err({ client: { kind: "new", name: "A", email: "nope" } }, /valid email/);
{
  const r = norm({ client: { kind: "new", name: "  Ana   Lee ", email: " Ana@X.Test " } });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.rule.client, { kind: "new", name: "Ana Lee", email: "ana@x.test" });
  const n = norm({ client: { kind: "new", name: "No Mail", email: "" } });
  assert.ok(n.ok);
  if (n.ok) assert.deepEqual(n.rule.client, { kind: "new", name: "No Mail", email: null });
}

// Payment notes: undefined = inherit, null/"" status = clear, bad status rejected.
{
  const r = norm({});
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.rule.payment, {});
  const r2 = norm({ payment: { status: "prepaid_package", note: " 6 of 10 paid ", split: "Parent 70%" } });
  assert.ok(r2.ok);
  if (r2.ok) assert.deepEqual(r2.rule.payment, { status: "prepaid_package", note: "6 of 10 paid", split: "Parent 70%" });
  err({ payment: { status: "free" } }, /payment status/);
  err({ payment: { note: "x".repeat(501) } }, /too long/);
}
assert.equal(norm({ notifyStudent: undefined }).ok && (norm({}) as { rule: { notifyStudent: boolean } }).rule.notifyStudent, false);

// Expansion — weekly, two slots a week, Toronto.
const TZ = "America/Toronto";
{
  const r = norm({
    slots: [{ weekday: 2, startMin: 960 }, { weekday: 4, startMin: 1080 }],
    startDate: "2026-09-16",
    endDate: "2026-09-30",
  });
  assert.ok(r.ok);
  if (r.ok) {
    const occ = expandOccurrences(r.rule, TZ);
    assert.deepEqual(
      occ.map((o) => [o.dateKey, o.start!.toISOString()]),
      [
        ["2026-09-17", "2026-09-17T22:00:00.000Z"],
        ["2026-09-22", "2026-09-22T20:00:00.000Z"],
        ["2026-09-24", "2026-09-24T22:00:00.000Z"],
        ["2026-09-29", "2026-09-29T20:00:00.000Z"],
      ],
    );
  }
}

// Every 2 weeks: shared parity, week 1 = Monday-based week containing the start date.
assert.equal(inRepeatWeek("2026-09-17", "2026-09-14", 2), true, "same Mon-Sun week as a Thursday start");
assert.equal(inRepeatWeek("2026-09-17", "2026-09-20", 2), true, "Sunday closes week 1");
assert.equal(inRepeatWeek("2026-09-17", "2026-09-21", 2), false);
assert.equal(inRepeatWeek("2026-09-17", "2026-09-28", 2), true);
{
  // Start Thursday: Tue of week 1 is before the start → first Tue is in week 3.
  const r = normalizeRule(
    { ...base, slots: [{ weekday: 2, startMin: 960 }, { weekday: 4, startMin: 960 }], startDate: "2026-09-17", endDate: "2026-10-16", intervalWeeks: 2 },
    { today, defaultDuration: 60 },
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(expandOccurrences(r.rule, TZ).map((o) => o.dateKey), ["2026-09-17", "2026-09-29", "2026-10-01", "2026-10-13", "2026-10-15"]);
  }
}

// DST: wall time kept across fall-back; spring-forward gap → no instant.
{
  const r = normalizeRule(
    { ...base, slots: [{ weekday: 0, startMin: 150 }, { weekday: 2, startMin: 960 }], startDate: "2026-10-25", endDate: "2027-03-16" },
    { today, defaultDuration: 30 },
  );
  assert.ok(r.ok);
  if (r.ok) {
    const occ = expandOccurrences(r.rule, TZ);
    const tue = occ.filter((o) => o.startMin === 960);
    assert.equal(tue.find((o) => o.dateKey === "2026-10-27")!.start!.toISOString(), "2026-10-27T20:00:00.000Z");
    assert.equal(tue.find((o) => o.dateKey === "2026-11-03")!.start!.toISOString(), "2026-11-03T21:00:00.000Z");
    const gap = occ.find((o) => o.dateKey === "2027-03-14")!;
    assert.equal(gap.start, null, "2:30 a.m. does not exist on spring-forward day");
    assert.equal(conflictFor(gap, [], [], new Date("2026-09-16T00:00:00Z"))?.reason, "time_missing");
  }
}
// Coach zone drives expansion.
{
  const r = norm({ startDate: "2026-09-22", endDate: "2026-09-22" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(expandOccurrences(r.rule, "America/Vancouver")[0].start!.toISOString(), "2026-09-22T23:00:00.000Z");
}

// Conflicts
const now = new Date("2026-09-16T12:00:00Z");
const occ = { dateKey: "2026-09-22", startMin: 960, durationMin: 60, start: new Date("2026-09-22T20:00:00Z"), end: new Date("2026-09-22T21:00:00Z") };
const lesson = (id: string, s: string, e: string, status = "confirmed", holdUntil: Date | null = null) => ({
  id, start: new Date(s), end: new Date(e), status, holdUntil, clientName: "Kay Swap",
});
assert.equal(conflictFor(occ, [], [], now), null);
assert.deepEqual(conflictFor(occ, [lesson("a", "2026-09-22T20:30:00Z", "2026-09-22T21:30:00Z")], [], now), { reason: "lesson", detail: "Overlaps Kay's lesson" });
assert.equal(conflictFor(occ, [lesson("a", "2026-09-22T21:00:00Z", "2026-09-22T22:00:00Z")], [], now), null, "touching is fine");
assert.equal(conflictFor(occ, [lesson("a", "2026-09-22T20:00:00Z", "2026-09-22T21:00:00Z", "cancelled")], [], now), null);
assert.equal(conflictFor(occ, [lesson("h", "2026-09-22T20:00:00Z", "2026-09-22T21:00:00Z", "held", new Date("2026-09-16T12:10:00Z"))], [], now)?.reason, "hold");
assert.equal(conflictFor(occ, [lesson("h", "2026-09-22T20:00:00Z", "2026-09-22T21:00:00Z", "held", new Date("2026-09-16T11:50:00Z"))], [], now), null, "expired hold is free");
assert.equal(conflictFor(occ, [lesson("a", "2026-09-22T20:00:00Z", "2026-09-22T21:00:00Z")], [], now, { ignoreLessonId: "a" }), null);
assert.equal(conflictFor(occ, [], [{ date: "2026-09-22", startMin: 12 * 60, endMin: 18 * 60 }], now)?.reason, "blocked");
assert.equal(conflictFor(occ, [], [{ date: "2026-09-22", startMin: 17 * 60, endMin: 18 * 60 }], now), null);
assert.equal(conflictFor(occ, [], [{ date: "2026-09-23", startMin: 0, endMin: 1440 }], now), null);
assert.equal(conflictFor(occ, [], [], new Date("2026-09-22T20:00:01Z"))?.reason, "past");

// Outside public hours
const hours = [{ weekday: 2, startMin: 600, endMin: 1200 }];
assert.equal(isOutsideHours({ weekday: 2, startMin: 960, durationMin: 60 }, hours), false);
assert.equal(isOutsideHours({ weekday: 2, startMin: 1170, durationMin: 60 }, hours), true);
assert.equal(isOutsideHours({ weekday: 6, startMin: 960, durationMin: 60 }, hours), true);

// Assistant helpers
assert.equal(detectLang("Emma 每周二下午四点"), "zh");
assert.equal(detectLang("Emma every Tuesday 4pm"), "en");
assert.equal(isConfirmImportText("确认导入"), true);
assert.equal(isConfirmImportText(" Confirm import. "), true);
assert.equal(isConfirmImportText("confirm"), false);
assert.equal(isConfirmImportText("确认导入吗？不要"), false);
assert.equal(parseClock("16:05"), 965);
assert.equal(parseClock("24:00"), null);

const preview: RecurringPreview = {
  client: { mode: "existing", id: "c1", name: "Emma Chen", email: null },
  location: { id: "l", name: "Court" },
  timezone: TZ,
  startDate: "2026-09-16",
  endDate: "2027-03-16",
  startLabel: "",
  endLabel: "",
  intervalWeeks: 1,
  slots: [
    { weekday: 2, startMin: 960, durationMin: 60, label: "Tue 4:00 p.m.–5:00 p.m.", durationChanged: false, outsideHours: false },
    { weekday: 4, startMin: 1080, durationMin: 60, label: "Thu 6:00 p.m.–7:00 p.m.", durationChanged: false, outsideHours: true },
  ],
  createCount: 50,
  skipCount: 2,
  skipped: [
    { dateKey: "2026-10-13", dateLabel: "", slotLabel: "Tue 4:00 p.m.–5:00 p.m.", reason: "lesson", detail: "" },
    { dateKey: "2026-12-24", dateLabel: "", slotLabel: "Thu 6:00 p.m.–7:00 p.m.", reason: "blocked", detail: "" },
  ],
  outsideHours: true,
  activeSeriesCount: 0,
  payment: { status: "prepaid_package", statusLabel: "Prepaid package", note: "6 of 10 paid", split: "" },
  notifyStudent: false,
  remindersOn: false,
  fingerprint: "x",
};
const zh = recapImport(preview, "zh");
for (const piece of ["Emma Chen", "无邮箱", "每周", "Tue 4:00", "Thu 6:00", "2026-09-16 至 2027-03-16", "共 50 节", "冲突跳过 2 节", "2026-10-13", "2026-12-24", "不在公开营业时间", "Prepaid package", "6 of 10 paid", "确认导入"]) {
  assert.ok(zh.includes(piece), `zh recap has ${piece}`);
}
const en = recapImport({ ...preview, client: { ...preview.client, email: "e@x.test" }, intervalWeeks: 2 }, "en");
for (const piece of ["Emma Chen (e@x.test)", "Every 2 weeks", "50 lessons, 2 skipped", "outside your public hours", "confirm import"]) {
  assert.ok(en.includes(piece), `en recap has ${piece}`);
}

console.log("recurring tests ok");
