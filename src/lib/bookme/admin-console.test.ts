import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  attentionList,
  can,
  cleanRange,
  formatCad,
  jobFreshness,
  monthLabel,
  periodRange,
  platformFeeCad,
  recentMonths,
  studentLabel,
  subscriptionTone,
  toCsv,
} from "./admin-console.ts";
import {
  addTeamMember,
  adminIdentity,
  resolveAdminAccess,
  coachDetail,
  extendTrial,
  health,
  lessonsReport,
  listCoaches,
  listTeam,
  lookupStudent,
  recentActions,
  recordAction,
  recordJobRun,
  removeTeamMember,
  revenue,
  setAccessGrant,
  setBanned,
  summary,
} from "./admin-service.ts";

// ---- pure ------------------------------------------------------------------
assert.equal(can("owner", "manage_team"), true);
assert.equal(can("admin", "manage_team"), false);
assert.equal(can("admin", "set_access"), false);
assert.equal(can("admin", "ban_coach"), false);
assert.equal(can("admin", "extend_trial"), true);
assert.equal(can("admin", "lookup_student"), true);
assert.equal(can("admin", "view"), true);
assert.equal(can(null, "view"), false);

assert.equal(platformFeeCad(100), 5);
assert.equal(platformFeeCad(85), 4.25);
assert.equal(platformFeeCad(0), 0);
assert.match(formatCad(1234.5), /1,234\.50/);
assert.equal(subscriptionTone("active", false), "good");
assert.equal(subscriptionTone("active", true), "bad");
assert.equal(subscriptionTone("trialing", false), "warn");
assert.equal(subscriptionTone("canceled", false), "muted");

const NOW = new Date("2031-06-17T15:00:00Z"); // Tue 11:00 Toronto
assert.deepEqual(periodRange("today", NOW), { from: "2031-06-17", to: "2031-06-17" });
assert.deepEqual(periodRange("week", NOW), { from: "2031-06-16", to: "2031-06-17" }, "week starts Monday");
assert.deepEqual(periodRange("month", NOW), { from: "2031-06-01", to: "2031-06-17" });
assert.equal(periodRange("all", NOW).from, "1970-01-01");
assert.deepEqual(recentMonths(3, NOW), ["2031-04", "2031-05", "2031-06"]);
assert.match(monthLabel("2031-06"), /Jun/);
assert.deepEqual(cleanRange("2031-06-01", "2031-06-10", NOW), { from: "2031-06-01", to: "2031-06-10" });
assert.deepEqual(cleanRange("bad", null, NOW), { from: "2031-05-19", to: "2031-06-17" }, "defaults to 30 days");
assert.deepEqual(cleanRange("2031-06-20", "2031-06-10", NOW), { from: "2031-06-10", to: "2031-06-10" }, "reversed range");
assert.equal(cleanRange("2000-01-01", "2031-06-17", NOW).from, "2030-05-13", "range capped at 400 days");

assert.deepEqual(
  attentionList({ trialEndingSoon: 2, pastDue: 0, stuckHolds: 5 }),
  [
    { kind: "stuckHolds", label: "Checkout holds stuck in 'held'", href: "/admin/lessons", count: 5 },
    { kind: "trialEndingSoon", label: "Trials ending within 3 days", href: "/admin/coaches", count: 2 },
  ],
  "only non-empty, biggest first",
);
assert.equal(jobFreshness(null).state, "never");
assert.equal(jobFreshness(new Date(NOW.getTime() - 3 * 3600_000), NOW).state, "ok");
assert.equal(jobFreshness(new Date(NOW.getTime() - 40 * 3600_000), NOW).state, "stale");
assert.equal(studentLabel(3, "Emma Chen"), "Student #3 (E.)");
assert.equal(studentLabel(1, null), "Student #1");
assert.equal(
  toCsv([{ a: 'x,"y"', b: 2 }], [{ key: "a", header: "A" }, { key: "b", header: "B" }]),
  'A,B\n"x,""y""",2\n',
);

// ---- database ---------------------------------------------------------------
const dir = new URL("../../../migrations/", import.meta.url);
const pg = new PGlite();
await pg.waitReady;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  await pg.transaction(async (tx) => { await tx.exec(readFileSync(new URL(f, dir), "utf8")); });
}
const sql = { query: async <T>(t: string, p: unknown[] = []) => (await pg.query<T>(t, p)).rows };
const one = async <T>(t: string, p: unknown[] = []) => (await sql.query<T>(t, p))[0];

const OWNER = "zhouxiyin1024@gmail.com";
await pg.exec(`
  insert into coaches (id, slug, name, email, title, sport, city, timezone, languages, plan, subscription_status,
                       trial_ends_at, banned, accept_card, accept_cash, stripe_account_id)
  values
    ('c-ana', 'ana', 'Ana Ray', 'ana@x.test', 'Coach', 'tennis', 'Toronto', 'America/Toronto', 'English', 'coach', 'active', null, false, true, true, 'acct_1'),
    ('c-ben', 'ben', 'Ben Fox', 'ben@x.test', 'Coach', 'golf', 'Markham', 'America/Toronto', 'English', 'light', 'trialing', now() + interval '2 days', false, true, false, null),
    ('c-cid', 'cid', 'Cid Lee', 'cid@x.test', 'Coach', 'swim', 'Ottawa', 'America/Toronto', 'English', 'none', 'canceled', null, false, false, true, null),
    ('c-staff', 'tim', 'Tim Z', '${OWNER}', 'Coach', 'tennis', 'Toronto', 'America/Toronto', 'English', 'coach', 'active', null, false, true, true, 'acct_9');
  insert into services (id, coach_id, name, duration, price_cad) values
    ('s-ana', 'c-ana', 'Private', 60, 100), ('s-ben', 'c-ben', 'Private', 60, 80), ('s-staff', 'c-staff', 'Private', 60, 80);
  insert into locations (id, coach_id, name, address, active) values
    ('l-ana', 'c-ana', 'Court', 'A', true), ('l-ben', 'c-ben', 'Range', 'B', true), ('l-staff', 'c-staff', 'Court', 'C', true);
  insert into clients (id, coach_id, name, email) values
    ('cl-1', 'c-ana', 'Emma Chen', 'Emma@X.test'), ('cl-2', 'c-ana', 'Kay', 'kay@x.test'),
    ('cl-3', 'c-ben', 'Emma C', 'emma@x.test'), ('cl-4', 'c-ana', 'No Mail', null),
    ('cl-5', 'c-staff', 'Emma S', 'emma@x.test');
  insert into students (id, email, last_login_at) values ('st-1', 'emma@x.test', now());
`);
async function lesson(id: string, coach: string, client: string, startIso: string, status: string, pay?: { method: string; status: string; amount: number }) {
  const svc = coach === "c-ana" ? "s-ana" : coach === "c-ben" ? "s-ben" : "s-staff";
  const loc = coach === "c-ana" ? "l-ana" : coach === "c-ben" ? "l-ben" : "l-staff";
  await sql.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
     values ($1,$2,$3,$4,$5,$6,$6::timestamptz + interval '1 hour',$7)`,
    [id, coach, svc, loc, client, startIso, status],
  );
  if (pay) {
    await sql.query(`insert into payments (id, lesson_id, method, status, amount_cad) values ($1,$2,$3,$4,$5)`, [
      `p-${id}`, id, pay.method, pay.status, pay.amount,
    ]);
  }
}
// June 2031 (reporting month), all times Toronto
await lesson("l1", "c-ana", "cl-1", "2031-06-17T14:00:00Z", "confirmed", { method: "card", status: "paid", amount: 100 });
await lesson("l2", "c-ana", "cl-2", "2031-06-16T14:00:00Z", "confirmed", { method: "cash", status: "marked_offline", amount: 100 });
await lesson("l3", "c-ana", "cl-1", "2031-06-10T14:00:00Z", "cancelled", { method: "card", status: "refunded", amount: 100 });
await lesson("l4", "c-ben", "cl-3", "2031-06-05T14:00:00Z", "completed", { method: "card", status: "paid", amount: 80 });
await lesson("l5", "c-ben", "cl-3", "2031-05-05T14:00:00Z", "confirmed", { method: "card", status: "paid", amount: 80 });
await lesson("l6", "c-ana", "cl-4", "2031-06-18T14:00:00Z", "confirmed"); // no payment row
await lesson("l-staff", "c-staff", "cl-5", "2031-06-17T16:00:00Z", "confirmed", { method: "card", status: "paid", amount: 500 });

// Access
assert.equal(await adminIdentity(sql, { email: OWNER, emailVerified: true }).then((r) => r?.role), "owner");
assert.equal(await adminIdentity(sql, { email: OWNER, emailVerified: false }), null, "unverified email is not an admin");
const unverified = await resolveAdminAccess(sql, { email: OWNER, emailVerified: false });
assert.equal(unverified.ok, false);
if (!unverified.ok) assert.equal(unverified.reason, "UNVERIFIED");
assert.equal(await adminIdentity(sql, { email: "ana@x.test", emailVerified: true }), null);
const notStaff = await resolveAdminAccess(sql, { email: "ana@x.test", emailVerified: true });
assert.equal(notStaff.ok, false);
if (!notStaff.ok) assert.equal(notStaff.reason, "NOT_STAFF");

// Founder bootstrap: verified ADMIN_EMAIL without staff row → owner + upsert
await sql.query(`delete from staff where lower(email) = $1`, [OWNER]);
assert.equal((await listTeam(sql)).length, 0, "staff cleared for bootstrap test");
const boot = await resolveAdminAccess(sql, { email: OWNER, emailVerified: true });
assert.equal(boot.ok && boot.identity.role, "owner", "founder verified without staff row → owner");
assert.equal(await adminIdentity(sql, { email: OWNER, emailVerified: true }).then((r) => r?.role), "owner");
assert.deepEqual((await listTeam(sql)).map((t) => ({ email: t.email, role: t.role })), [{ email: OWNER, role: "owner" }], "upserted owner row");
// Idempotent second access
assert.equal(await adminIdentity(sql, { email: OWNER, emailVerified: true }).then((r) => r?.role), "owner");
assert.equal((await listTeam(sql)).length, 1, "bootstrap upsert is idempotent");
assert.equal(await adminIdentity(sql, { email: OWNER, emailVerified: false }), null, "unverified still denied after bootstrap");
assert.equal(await adminIdentity(sql, { email: "random@x.test", emailVerified: true }), null, "random verified not in staff → null");

assert.ok((await addTeamMember(sql, " Lyra@Example.COM ", OWNER)).ok);
assert.equal(await adminIdentity(sql, { email: "lyra@example.com", emailVerified: true }).then((r) => r?.role), "admin");
assert.equal((await addTeamMember(sql, "not-an-email", OWNER)).ok, false);
assert.equal((await removeTeamMember(sql, OWNER)).ok, false, "owner cannot be removed");
assert.ok((await removeTeamMember(sql, "lyra@example.com")).ok);
assert.equal(await adminIdentity(sql, { email: "lyra@example.com", emailVerified: true }), null);
await addTeamMember(sql, "lyra@example.com", OWNER);
assert.deepEqual((await listTeam(sql)).map((t) => t.role).sort(), ["admin", "owner"]);

// Summary — staff-owned coaches never count
const s = await summary(sql, "month", NOW);
assert.equal(s.coaches.total, 3, "staff coach excluded");
assert.deepEqual([s.coaches.active, s.coaches.trialing], [1, 1]);
assert.equal(s.lessons.booked, 4, "June 1–17 lessons of real coaches (l1,l2,l3,l4); l6 is still in the future");
assert.equal(s.lessons.confirmed, 3, "confirmed + completed");
assert.equal(s.lessons.cancelled, 1);
assert.equal(s.money.cardPaid, 180, "l1 + l4; the staff coach's 500 is excluded");
assert.equal(s.money.platformFee, 9);
assert.equal(s.money.cashCollected, 100);
assert.equal(s.money.refunded, 100);
assert.equal(s.attention.trialEndingSoon, 1, "Ben's trial ends in 2 days");
assert.equal(s.attention.cardWithoutStripe, 1, "Ben takes cards without Stripe");
assert.equal(s.attention.lessonsWithoutPayment >= 1, true);
const today = await summary(sql, "today", NOW);
assert.equal(today.money.cardPaid, 100, "only today's lesson");

// Coaches list
const list = await listCoaches(sql, { sort: "revenue" });
assert.equal(list.total, 3);
assert.deepEqual(list.coaches.map((c) => c.id), ["c-ben", "c-ana", "c-cid"], "by card revenue: Ben 160, Ana 100, Cid 0");
const ana = list.coaches.find((c) => c.id === "c-ana")!;
const ben = list.coaches.find((c) => c.id === "c-ben")!;
assert.equal(ana.cardPaid, 100);
assert.equal(ana.platformFee, 5);
assert.equal(ana.clients, 3);
assert.equal(ana.cashCollected, 100);
assert.equal(ana.stripeConnected, true);
assert.equal(ben.cardPaid, 160);
assert.equal(ben.stripeConnected, false);
assert.deepEqual((await listCoaches(sql, { search: "ben" })).coaches.map((c) => c.id), ["c-ben"]);
assert.deepEqual((await listCoaches(sql, { search: "X.TEST" })).coaches.length, 3, "search is case-insensitive");
assert.deepEqual((await listCoaches(sql, { status: "trialing" })).coaches.map((c) => c.id), ["c-ben"]);
assert.deepEqual((await listCoaches(sql, { status: "lapsed" })).coaches.map((c) => c.id), ["c-cid"]);
assert.equal((await listCoaches(sql, { limit: 10, offset: 10 })).coaches.length, 0);

// Coach detail
const detail = (await coachDetail(sql, "c-ana"))!;
assert.equal(detail.coach.email, "ana@x.test");
assert.equal(detail.coach.specialty, "Tennis", "preset sport still labels the coach");
assert.equal(detail.lessons.confirmed, 3);
assert.equal(detail.lessons.cancelled, 1);
assert.equal(detail.clients.total, 3);
assert.equal(detail.clients.withEmail, 2);
assert.equal(detail.months.find((m) => m.month === "2031-06")!.platformFee, 5);
assert.equal(await coachDetail(sql, "nope"), null);
assert.equal(JSON.stringify(detail).includes("Emma"), false, "coach detail never names students");

// Revenue
const rev = await revenue(sql, 3, NOW);
assert.deepEqual(rev.map((r) => r.month), ["2031-04", "2031-05", "2031-06"]);
assert.equal(rev[1].cardPaid, 80);
assert.equal(rev[2].cardPaid, 180);
assert.equal(rev[2].platformFee, 9);
assert.equal(rev[2].coachShare, 171);
assert.equal(rev[0].cardPaid, 0);

// Lessons report
const rep = await lessonsReport(sql, { from: "2031-06-01", to: "2031-06-30" }, NOW);
assert.equal(rep.lessons.length, 5, "the whole of June, including the future lesson");
assert.ok(rep.lessons.every((l) => l.student.startsWith("Student #")), "students anonymised");
assert.equal(JSON.stringify(rep).includes("Emma"), false);
assert.equal(JSON.stringify(rep).includes("@x.test"), false);
assert.equal(rep.anomalies.missingPayment >= 1, true);
assert.equal((await lessonsReport(sql, { from: "2031-06-01", to: "2031-06-30", status: "cancelled" }, NOW)).lessons.length, 1);
assert.equal((await lessonsReport(sql, { from: "2031-06-01", to: "2031-06-30", coachId: "c-ben" }, NOW)).lessons.length, 1);

// Student lookup
const look = await lookupStudent(sql, " EMMA@x.test ");
assert.ok(look.ok);
if (look.ok) {
  assert.equal(look.email, "emma@x.test");
  assert.equal(look.hasPortalAccount, true);
  assert.deepEqual(look.lessons.map((l) => l.id).sort(), ["l1", "l3", "l4", "l5", "l-staff"].sort(), "across coaches, case-insensitive");
  assert.equal(JSON.stringify(look).includes("note"), false, "no coach notes");
}
assert.equal((await lookupStudent(sql, "bad")).ok, false);

// Actions on coaches + audit
assert.ok((await setAccessGrant(sql, "c-ben", "paid")).ok);
assert.equal((await setAccessGrant(sql, "c-ben", "nonsense")).ok, false);
assert.ok((await setBanned(sql, "c-cid", true)).ok);
assert.equal((await setBanned(sql, "c-staff", true)).ok, false, "staff coaches can't be banned");
assert.equal((await one<{ banned: boolean }>(`select banned from coaches where id = 'c-cid'`)).banned, true);
const ext = await extendTrial(sql, "c-ben", 14, NOW);
assert.ok(ext.ok);
if (ext.ok) assert.equal(ext.trialEndsAt.slice(0, 10), "2031-07-01", "a lapsed trial extends from today");
assert.equal((await extendTrial(sql, "c-ana", 1000, NOW)).ok, true);
assert.equal((await one<{ t: string }>(`select to_char(trial_ends_at, 'YYYY-MM-DD') as t from coaches where id = 'c-ana'`)).t, "2031-09-15", "capped at 90 days");

await recordAction(sql, { email: OWNER, role: "owner" }, { kind: "set_access", subjectType: "coach", subjectId: "c-ben", detail: "paid", note: "promo" });
await recordAction(sql, { email: "lyra@example.com", role: "admin" }, { kind: "lookup_student", subjectType: "student_email", subjectId: "emma@x.test" });
const log = await recentActions(sql, 10);
assert.equal(log.length, 2);
assert.equal(log[0].kind, "lookup_student", "newest first");
assert.deepEqual((await recentActions(sql, 10, { type: "coach", id: "c-ben" })).map((a) => a.kind), ["set_access"]);

// Health
await recordJobRun(sql, "reminders", true, "sent 3, purged 0");
const h = await health(sql, NOW);
assert.deepEqual(h.jobs.map((j) => j.job), ["reminders"]);
assert.equal(h.counts.clientsWithoutEmail, 1);
assert.equal(h.counts.studentAccounts, 1);
assert.equal(typeof h.counts.pendingPurge, "number");

await pg.close();
console.log("admin-console tests ok");
