import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { addMonthsKey } from "./time.ts";
import { buildImportPlan, confirmImport, endSeries, type ImportCoach } from "./recurring-service.ts";
import type { RecurringRuleInput } from "./recurring.ts";

const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
assert.ok(files.includes("0007_recurring_series.sql"));

const db = new PGlite();
await db.waitReady;
for (const f of files) {
  await db.transaction(async (tx) => {
    await tx.exec(readFileSync(new URL(f, dir), "utf8"));
  });
}
// Demo coaches are dev-only since 0010.
await db.exec(readFileSync(new URL("dev/seed.sql", dir), "utf8"));
const sql = { query: async <T>(t: string, p: unknown[] = []) => (await db.query<T>(t, p)).rows };
const one = async <T>(t: string, p: unknown[] = []) => (await sql.query<T>(t, p))[0];

const DAN = "coach-daniel-kim";
const TIM = "coach-tim-zhang";
// Fixed clock: Tue 2030-12-03 12:00 UTC (7:00 a.m. Toronto).
const NOW = new Date("2030-12-03T12:00:00Z");

async function coachFor(id: string, open = true): Promise<ImportCoach> {
  const c = await one<{ timezone: string }>(`select timezone from coaches where id = $1`, [id]);
  const svc = await one<{ id: string; duration: number }>(`select id, duration from services where coach_id = $1 order by name limit 1`, [id]);
  const locs = await sql.query<{ id: string; name: string }>(`select id, name from locations where coach_id = $1 and active order by name`, [id]);
  const hours = await sql.query<{ weekday: number; start_min: number; end_min: number }>(`select weekday, start_min, end_min from weekly_hours where coach_id = $1`, [id]);
  return {
    id,
    timezone: c.timezone,
    open,
    service: svc ?? null,
    locations: locs,
    hours: hours.map((h) => ({ weekday: h.weekday, startMin: h.start_min, endMin: h.end_min })),
  };
}

async function addLesson(id: string, coach: string, client: string, start: string, mins: number, status = "confirmed", holdUntil: string | null = null) {
  const svc = coach === DAN ? "svc-daniel-private" : "svc-tim-private";
  const loc = coach === DAN ? "loc-daniel-mayfair" : "loc-tim-blackmore";
  await db.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status, hold_until)
     values ($1,$2,$3,$4,$5,$6,$6::timestamptz + make_interval(mins => $7),$8,$9)`,
    [id, coach, svc, loc, client, start, mins, status, holdUntil],
  );
}

await db.exec(`
  insert into clients (id, coach_id, name, email, payment_status, payment_note, split_ratio) values
    ('kay', '${DAN}', 'Kay Swap', 'kay@x.test', null, '', ''),
    ('emma', '${DAN}', 'Emma Chen', 'emma@x.test', 'prepaid_package', '6 of 10 paid', 'Parent 70%'),
    ('tim-emma', '${TIM}', 'Emma Chen', 'emma@x.test', 'monthly', 'tim note', '');
`);
// Tue 2030-12-10 16:00 Toronto = 21:00Z (EST). Kay's lesson overlaps Emma's Tuesday slot.
await addLesson("kay-1", DAN, "kay", "2030-12-10T21:30:00Z", 60);
// Open hold on Thu 2030-12-12 18:00 Toronto = 23:00Z; expired hold on Thu 12-19.
await addLesson("hold-open", DAN, "kay", "2030-12-12T23:00:00Z", 60, "held", "2030-12-03T12:10:00Z");
await addLesson("hold-old", DAN, "kay", "2030-12-19T23:00:00Z", 60, "held", "2030-12-03T11:00:00Z");
// Cancelled lesson does not block.
await addLesson("cx", DAN, "kay", "2030-12-17T21:00:00Z", 60, "cancelled");
// Tim's lesson at the same time does not block Daniel.
await addLesson("tim-1", TIM, "tim-emma", "2030-12-24T21:00:00Z", 60);
// Christmas Eve blocked for Daniel.
await db.exec(`insert into date_blocks (id, coach_id, date, start_min, end_min) values ('b1', '${DAN}', '2030-12-24', 0, 1440)`);

const dan = await coachFor(DAN);
assert.equal(dan.service?.duration, 60);

const rule: RecurringRuleInput = {
  client: { kind: "existing", id: "emma" },
  slots: [
    { weekday: 2, startMin: 16 * 60 },
    { weekday: 4, startMin: 18 * 60 },
    { weekday: 6, startMin: 9 * 60, durationMin: 120 },
  ],
  startDate: "2030-12-03",
  endDate: "2030-12-31",
  intervalWeeks: 1,
};

// ---- Preview -------------------------------------------------------------
const p1 = await buildImportPlan(sql, dan, rule, NOW);
assert.ok(p1.ok, !p1.ok ? p1.error : "");
if (!p1.ok) throw new Error();
const pv = p1.plan.preview;
// Tue: 3,10,17,24,31 · Thu: 5,12,19,26 · Sat: 7,14,21,28 = 13 dates.
assert.equal(pv.createCount + pv.skipCount, 13);
assert.deepEqual(
  pv.skipped.map((s) => [s.dateKey, s.reason]),
  [
    ["2030-12-10", "lesson"],
    ["2030-12-12", "hold"],
    ["2030-12-24", "blocked"],
  ],
);
assert.equal(pv.skipped[0].detail, "Overlaps Kay's lesson");
assert.equal(pv.createCount, 10);
assert.equal(pv.client.mode, "existing");
assert.deepEqual(pv.payment, { status: "prepaid_package", statusLabel: "Prepaid package", note: "6 of 10 paid", split: "Parent 70%" }, "copied from client");
assert.deepEqual(pv.slots.map((s) => s.outsideHours), [false, false, true], "Saturday is outside Mon–Fri hours");
assert.equal(pv.outsideHours, true);
assert.equal(pv.slots[2].durationChanged, true);
assert.equal(pv.location.id, "loc-daniel-mayfair");
assert.equal(pv.timezone, "America/Toronto");
assert.equal(pv.remindersOn, true);
assert.equal(pv.notifyStudent, false);
// Nothing written by preview.
assert.equal((await sql.query(`select 1 from recurring_series`)).length, 0);

const p1b = await buildImportPlan(sql, dan, rule, NOW);
assert.ok(p1b.ok && p1b.plan.preview.fingerprint === pv.fingerprint, "fingerprint is stable");

// Gates
const closed = await buildImportPlan(sql, await coachFor(DAN, false), rule, NOW);
assert.equal(closed.ok, false);
const foreign = await buildImportPlan(sql, dan, { ...rule, client: { kind: "existing", id: "tim-emma" } }, NOW);
assert.deepEqual(foreign, { ok: false, error: "Client not found." }, "never another coach's client");
const badLoc = await buildImportPlan(sql, dan, { ...rule, locationId: "loc-tim-blackmore" }, NOW);
assert.equal(badLoc.ok, false);
const past = await buildImportPlan(sql, dan, { ...rule, startDate: "2030-12-02" }, NOW);
assert.equal(past.ok, false);
const empty = await buildImportPlan(sql, dan, { ...rule, slots: [{ weekday: 1, startMin: 600 }], startDate: "2030-12-03", endDate: "2030-12-08" }, NOW);
assert.equal(empty.ok, false);

// New client matching an existing email of THIS coach → existing record.
const byEmail = await buildImportPlan(sql, dan, { ...rule, client: { kind: "new", name: "Someone", email: "EMMA@x.test" } }, NOW);
assert.ok(byEmail.ok && byEmail.plan.preview.client.id === "emma" && byEmail.plan.preview.client.name === "Emma Chen");

// ---- Stale fingerprint ---------------------------------------------------
await addLesson("late", DAN, "kay", "2030-12-19T23:00:00Z", 60);
const stale = await confirmImport(sql, dan, rule, pv.fingerprint, "form", NOW);
assert.equal(stale.ok, false);
if (!stale.ok && stale.stale) {
  assert.equal(stale.preview.createCount, 9);
  assert.equal(stale.preview.skipCount, 4);
} else assert.fail("expected stale result");
assert.equal((await sql.query(`select 1 from recurring_series`)).length, 0, "stale confirm writes nothing");
assert.equal((await confirmImport(sql, dan, rule, "", "form", NOW)).ok, false);

// ---- Confirm ---------------------------------------------------------------
const override = { ...rule, payment: { note: "series only note" } };
const fresh = await buildImportPlan(sql, dan, override, NOW);
assert.ok(fresh.ok);
if (!fresh.ok) throw new Error();
const done = await confirmImport(sql, dan, override, fresh.plan.preview.fingerprint, "form", NOW);
assert.ok(done.ok, !done.ok ? done.error : "");
if (!done.ok) throw new Error();
assert.equal(done.done.created, 9);
const series = await one<Record<string, unknown>>(`select * from recurring_series where id = $1`, [done.done.seriesId]);
assert.equal(series.coach_id, DAN);
assert.equal(series.client_id, "emma");
assert.equal(series.status, "active");
assert.equal(series.payment_status, "prepaid_package");
assert.equal(series.payment_note, "series only note");
assert.equal(series.split_ratio, "Parent 70%");
assert.equal(series.lesson_count, 9);
assert.equal(series.skipped_count, 4);
assert.equal(series.created_via, "form");
const emmaAfter = await one<{ payment_note: string }>(`select payment_note from clients where id = 'emma'`);
assert.equal(emmaAfter.payment_note, "6 of 10 paid", "client-level note is not overwritten by the series");
assert.equal((await sql.query(`select 1 from recurring_slots where series_id = $1`, [done.done.seriesId])).length, 3);
const lessons = await sql.query<{ start_at: Date; end_at: Date; status: string; source: string; duration_min: number; method: string; pstatus: string; amount_cad: number }>(
  `select l.start_at, l.end_at, l.status, l.source, l.duration_min, p.method, p.status as pstatus, p.amount_cad
   from lessons l join payments p on p.lesson_id = l.id where l.series_id = $1 order by l.start_at`,
  [done.done.seriesId],
);
assert.equal(lessons.length, 9);
for (const l of lessons) {
  assert.deepEqual([l.status, l.source, l.method, l.pstatus], ["confirmed", "imported_recurring", "offline", "not_tracked"]);
}
const sat = lessons.find((l) => new Date(l.start_at).toISOString() === "2030-12-07T14:00:00.000Z")!;
assert.equal(sat.duration_min, 120);
assert.equal(new Date(sat.end_at).toISOString(), "2030-12-07T16:00:00.000Z");
assert.equal(
  new Date(lessons[0].start_at).toISOString(),
  "2030-12-03T21:00:00.000Z",
  "today's 4 p.m. is still ahead of 7 a.m. and is created",
);

// Imported lessons now occupy inventory: a second identical import skips everything.
const again = await buildImportPlan(sql, dan, rule, NOW);
assert.ok(again.ok);
if (again.ok) {
  assert.equal(again.plan.preview.createCount, 0);
  assert.equal(again.plan.preview.activeSeriesCount, 1, "warns about the existing active series");
  const none = await confirmImport(sql, dan, rule, again.plan.preview.fingerprint, "form", NOW);
  assert.equal(none.ok, false);
}

// New client without email; new client with email (stored lower-case, client-level payment set).
const noMail: RecurringRuleInput = {
  client: { kind: "new", name: "Nia NoMail" },
  slots: [{ weekday: 1, startMin: 7 * 60, durationMin: 30 }],
  startDate: "2030-12-09",
  endDate: "2030-12-16",
  intervalWeeks: 2,
  notifyStudent: true,
  payment: { status: "outside_platform", note: "cash" },
};
const nm = await buildImportPlan(sql, dan, noMail, NOW);
assert.ok(nm.ok);
if (!nm.ok) throw new Error();
assert.equal(nm.plan.preview.client.email, null);
assert.equal(nm.plan.preview.remindersOn, false);
assert.equal(nm.plan.preview.notifyStudent, false, "cannot notify without email");
assert.equal(nm.plan.preview.createCount, 1, "every 2 weeks: Dec 9 only");
const nmDone = await confirmImport(sql, dan, noMail, nm.plan.preview.fingerprint, "assistant", NOW);
assert.ok(nmDone.ok);
if (nmDone.ok) {
  const c = await one<{ coach_id: string; email: string | null; payment_status: string; payment_note: string }>(
    `select coach_id, email, payment_status, payment_note from clients where id = $1`,
    [nmDone.done.clientId],
  );
  assert.deepEqual(c, { coach_id: DAN, email: null, payment_status: "outside_platform", payment_note: "cash" });
}
const withMail: RecurringRuleInput = { ...noMail, client: { kind: "new", name: "Omar New", email: "Omar@New.Test" }, slots: [{ weekday: 1, startMin: 8 * 60 }] };
const wm = await buildImportPlan(sql, dan, withMail, NOW);
assert.ok(wm.ok);
if (wm.ok) {
  const d = await confirmImport(sql, dan, withMail, wm.plan.preview.fingerprint, "form", NOW);
  assert.ok(d.ok);
  if (d.ok) {
    const c = await one<{ email: string; payment_status: string }>(`select email, payment_status from clients where id = $1`, [d.done.clientId]);
    assert.deepEqual(c, { email: "omar@new.test", payment_status: "outside_platform" });
  }
}
// Tim's record for the same student is untouched.
assert.deepEqual(await one(`select payment_status, payment_note from clients where id = 'tim-emma'`), { payment_status: "monthly", payment_note: "tim note" });

// ---- End series ------------------------------------------------------------
await db.exec(`
  insert into booking_requests (id, coach_id, kind, lesson_id, proposed_start, created_by, student_decision)
  select 'req-late', '${DAN}', 'student_move', id, start_at + interval '1 day', 'student', 'accepted'
  from lessons where series_id = '${done.done.seriesId}' and start_at = '2030-12-26T23:00:00Z';
  insert into booking_requests (id, coach_id, kind, lesson_id, proposed_start, created_by, student_decision)
  select 'req-early', '${DAN}', 'student_move', id, start_at + interval '1 day', 'student', 'accepted'
  from lessons where series_id = '${done.done.seriesId}' and start_at = '2030-12-05T23:00:00Z';
`);
assert.equal((await endSeries(sql, DAN, done.done.seriesId, "2030-12-02", NOW)).ok, false, "not before today");
assert.equal((await endSeries(sql, TIM, done.done.seriesId, "2030-12-20", NOW)).ok, false, "other coach");
const ended = await endSeries(sql, DAN, done.done.seriesId, "2030-12-20", NOW);
assert.ok(ended.ok);
if (ended.ok) assert.equal(ended.done.cancelled, 4, "Sat 21, Thu 26, Sat 28, Tue 31");
const statuses = await sql.query<{ d: string; status: string }>(
  `select to_char(start_at at time zone 'America/Toronto', 'MM-DD') as d, status from lessons where series_id = $1 order by start_at`,
  [done.done.seriesId],
);
assert.deepEqual(
  statuses.map((r) => `${r.d} ${r.status}`),
  [
    "12-03 confirmed",
    "12-05 confirmed",
    "12-07 confirmed",
    "12-14 confirmed",
    "12-17 confirmed",
    "12-21 cancelled",
    "12-26 cancelled",
    "12-28 cancelled",
    "12-31 cancelled",
  ],
  "earlier lessons stay; from the end date on they are cancelled",
);
assert.equal((await one<{ status: string }>(`select status from booking_requests where id = 'req-late'`)).status, "cancelled");
assert.equal((await one<{ status: string }>(`select status from booking_requests where id = 'req-early'`)).status, "pending");
const s2 = await one<{ status: string; ended_from: string }>(`select status, ended_from::text from recurring_series where id = $1`, [done.done.seriesId]);
assert.deepEqual(s2, { status: "ended", ended_from: "2030-12-20" });
assert.equal((await endSeries(sql, DAN, done.done.seriesId, "2030-12-20", NOW)).ok, false, "already ended");

// ---- Database guards -------------------------------------------------------
for (const [start, end, ok] of [
  ["2027-03-31", "2027-09-30", true],
  ["2027-03-31", "2027-10-01", false],
  ["2026-08-31", "2027-02-28", true],
  ["2026-08-31", "2027-03-01", false],
  ["2027-08-31", "2028-02-29", true],
  ["2026-09-16", "2027-03-16", true],
  ["2026-09-16", "2027-03-17", false],
] as const) {
  assert.equal(addMonthsKey(start, 6) >= end, ok, `app rule ${start}→${end}`);
  const attempt = db.query(
    `insert into recurring_series (id, coach_id, client_id, service_id, location_id, interval_weeks, start_date, end_date, timezone, created_via)
     values ($1, $2, 'kay', 'svc-daniel-private', 'loc-daniel-mayfair', 1, $3, $4, 'America/Toronto', 'form')`,
    [`span-${start}-${end}`, DAN, start, end],
  );
  if (ok) await attempt;
  else await assert.rejects(attempt, /recurring_series_span_check/, `db rule ${start}→${end}`);
}
await assert.rejects(
  db.query(
    `insert into recurring_series (id, coach_id, client_id, service_id, location_id, interval_weeks, start_date, end_date, timezone, created_via)
     values ('x-foreign', $1, 'tim-emma', 'svc-daniel-private', 'loc-daniel-mayfair', 1, '2030-12-03', '2030-12-04', 'UTC', 'form')`,
    [DAN],
  ),
  /recurring_series_client_coach_fkey/,
);
await assert.rejects(
  db.query(`insert into recurring_slots (id, series_id, weekday, start_min, duration_min) values ('bad', $1, 1, 600, 150)`, [done.done.seriesId]),
  /check/,
);
await assert.rejects(
  db.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, source)
     values ('orphan-import', $1, 'svc-daniel-private', 'loc-daniel-mayfair', 'kay', now(), now(), 'imported_recurring')`,
    [DAN],
  ),
  /lessons_imported_has_series_check/,
);
await assert.rejects(
  db.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, source, series_id)
     values ('cross-series', $1, 'svc-tim-private', 'loc-tim-blackmore', 'tim-emma', now(), now(), 'imported_recurring', $2)`,
    [TIM, done.done.seriesId],
  ),
  /lessons_series_coach_fkey/,
);

await db.close();
console.log("recurring-service tests ok");
