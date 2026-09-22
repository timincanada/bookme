import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { checkCoachDeletion, deactivateCoach, deleteStudent, purgeDeletedCoaches } from "./account-deletion.ts";
import { pushCredentials, pushToCoach, pushToStudentEmail, registerDevice, setPushTransport, type PushMessage } from "./push.ts";

const dir = new URL("../../../migrations/", import.meta.url);
const pg = new PGlite();
await pg.waitReady;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  await pg.transaction(async (tx) => { await tx.exec(readFileSync(new URL(f, dir), "utf8")); });
}
await pg.exec(readFileSync(new URL("dev/seed.sql", dir), "utf8")); // demo coaches are dev-only since 0010
const sql = { query: async <T>(t: string, p: unknown[] = []) => (await pg.query<T>(t, p)).rows };
const one = async <T>(t: string, p: unknown[] = []) => (await sql.query<T>(t, p))[0];
const NOW = new Date("2031-05-01T12:00:00Z");
const DAN = "coach-daniel-kim";
const TIM = "coach-tim-zhang";

await pg.exec(`
  insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ('u-dan', 'Daniel Kim', 'daniel@real.test', true, now(), now());
  insert into "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId") values ('s-dan', now() + interval '1 day', 'tok', now(), now(), 'u-dan');
  insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") values ('a-dan', 'u-dan', 'credential', 'u-dan', 'hash', now(), now());
  update coaches set user_id = 'u-dan', stripe_account_id = 'acct_1', stripe_subscription_id = 'sub_1', bio = 'Real bio', photo_url = 'x.jpg' where id = '${DAN}';
  insert into clients (id, coach_id, name, email, phone, note, payment_note) values
    ('dan-emma', '${DAN}', 'Emma Chen', 'emma@x.test', '555', 'knee injury', 'paid 6/10'),
    ('tim-emma', '${TIM}', 'Emma C.', 'Emma@X.test', '555', 'tim note', ''),
    ('tim-kay', '${TIM}', 'Kay', 'kay@x.test', null, '', '');
  insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status) values
    ('past', '${DAN}', 'svc-daniel-private', 'loc-daniel-mayfair', 'dan-emma', '2031-04-01T15:00Z', '2031-04-01T16:00Z', 'confirmed'),
    ('future', '${DAN}', 'svc-daniel-private', 'loc-daniel-mayfair', 'dan-emma', '2031-05-10T15:00Z', '2031-05-10T16:00Z', 'confirmed'),
    ('tim-past', '${TIM}', 'svc-tim-private', 'loc-tim-blackmore', 'tim-emma', '2031-04-02T15:00Z', '2031-04-02T16:00Z', 'confirmed');
  insert into payments (id, lesson_id, method, status, amount_cad) values ('p-past', 'past', 'card', 'paid', 85);
  insert into students (id, email) values ('st-emma', 'emma@x.test'), ('st-kay', 'kay@x.test');
  insert into student_sessions (id, email, expires_at, token_hash, student_id) values ('ss-emma', 'emma@x.test', now() + interval '30 day', 'h1', 'st-emma');
  insert into manage_links (id, email, code_hash, token_hash, expires_at) values ('ml-emma', 'emma@x.test', 'c', 't', now() + interval '1 hour');
  insert into conversations (id, coach_id, client_id) values ('cv-dan', '${DAN}', 'dan-emma'), ('cv-tim', '${TIM}', 'tim-emma'), ('cv-kay', '${TIM}', 'tim-kay');
  insert into messages (id, conversation_id, sender_role, sender_student_id, body) values
    ('m1', 'cv-dan', 'student', 'st-emma', 'my knee hurts'), ('m2', 'cv-tim', 'coach', null, 'hi'), ('m3', 'cv-kay', 'student', 'st-kay', 'hey');
`);

// ---- Push ------------------------------------------------------------------
{
  assert.deepEqual(pushCredentials({}), { apns: false, fcm: false });
  assert.deepEqual(
    pushCredentials({ APNS_KEY_ID: "k", APNS_TEAM_ID: "t", APNS_PRIVATE_KEY: "p", APNS_BUNDLE_ID: "app.bookme.training", FCM_PROJECT_ID: "f", FCM_SERVICE_ACCOUNT_JSON: "{}" }),
    { apns: true, fcm: true },
  );
  assert.equal((await registerDevice(sql, { coachId: DAN }, { token: "short", platform: "ios" })).ok, false);
  assert.equal((await registerDevice(sql, { coachId: DAN }, { token: "x".repeat(32), platform: "web" })).ok, false);
  assert.ok((await registerDevice(sql, { coachId: DAN }, { token: "dan-ios-token-0000000000", platform: "ios" })).ok);
  assert.ok((await registerDevice(sql, { studentId: "st-emma" }, { token: "emma-android-token-00000", platform: "android" })).ok);
  // same phone signs in as someone else → token moves, never shared
  assert.ok((await registerDevice(sql, { studentId: "st-kay" }, { token: "dan-ios-token-0000000000", platform: "ios" })).ok);
  const moved = await one<{ coach_id: string | null; student_id: string | null }>(`select coach_id, student_id from device_tokens where token = 'dan-ios-token-0000000000'`);
  assert.deepEqual(moved, { coach_id: null, student_id: "st-kay" });
  assert.ok((await registerDevice(sql, { coachId: DAN }, { token: "dan-ios-token-0000000000", platform: "ios" })).ok);

  // no transport → skipped, nothing thrown
  assert.deepEqual(await pushToCoach(sql, DAN, { title: "t", body: "b", path: "/app" }), { sent: 0, skipped: 1 });

  const sent: Array<{ token: string; msg: PushMessage }> = [];
  setPushTransport({
    name: "test",
    async send(device, msg) {
      sent.push({ token: device.token, msg });
      return { ok: true, invalidToken: device.token.startsWith("emma") };
    },
  });
  assert.deepEqual(await pushToCoach(sql, DAN, { title: "New booking", body: "Emma", path: "/app/lessons/x" }), { sent: 1, skipped: 0 });
  assert.deepEqual(await pushToCoach(sql, TIM, { title: "x", body: "y", path: "/app" }), { sent: 0, skipped: 0 }, "other coach has no devices");
  assert.deepEqual(await pushToStudentEmail(sql, "EMMA@x.test", { title: "New message", body: "From Daniel", path: "/manage/messages/x" }), { sent: 1, skipped: 0 });
  assert.equal((await sql.query(`select 1 from device_tokens where token like 'emma%'`)).length, 0, "invalid tokens are removed");
  assert.deepEqual(sent.map((s) => s.token), ["dan-ios-token-0000000000", "emma-android-token-00000"]);
  assert.deepEqual(await pushToStudentEmail(sql, null, { title: "x", body: "y", path: "/" }), { sent: 0, skipped: 0 });
  setPushTransport(null);
  await registerDevice(sql, { studentId: "st-emma" }, { token: "emma-ios-token-000000000", platform: "ios" });
}

// ---- Student deletion ------------------------------------------------------
{
  const r = await deleteStudent(sql, "st-emma", NOW);
  assert.deepEqual(r, { ok: true, clients: 2 });
  const rows = await sql.query<{ id: string; name: string; email: string | null; phone: string | null; note: string; payment_note: string }>(
    `select id, name, email, phone, note, payment_note from clients where id in ('dan-emma', 'tim-emma') order by id`,
  );
  assert.deepEqual(rows.map((c) => [c.id, c.name, c.email, c.phone]), [
    ["dan-emma", "Deleted student", null, null],
    ["tim-emma", "Deleted student", null, null],
  ]);
  assert.equal(rows[0].note, "knee injury", "coach's own notes stay with the coach");
  assert.equal(Number((await one<{ n: number }>(`select count(*)::int n from lessons where client_id in ('dan-emma','tim-emma')`)).n), 3, "history kept");
  assert.equal((await sql.query(`select 1 from conversations where id in ('cv-dan','cv-tim')`)).length, 0, "conversations removed");
  assert.equal((await sql.query(`select 1 from messages where id in ('m1','m2')`)).length, 0);
  assert.equal((await sql.query(`select 1 from messages where id = 'm3'`)).length, 1, "other students untouched");
  assert.equal((await sql.query(`select 1 from students where id = 'st-emma'`)).length, 0);
  assert.equal((await sql.query(`select 1 from student_sessions where id = 'ss-emma'`)).length, 0);
  assert.equal((await sql.query(`select 1 from manage_links where id = 'ml-emma'`)).length, 0);
  assert.equal((await sql.query(`select 1 from device_tokens where token like 'emma%'`)).length, 0);
  assert.equal((await one<{ name: string }>(`select name from clients where id = 'tim-kay'`)).name, "Kay");
  const audit = await one<{ kind: string; subject_id: string }>(`select kind, subject_id from account_deletions where kind = 'student'`);
  assert.deepEqual(audit, { kind: "student", subject_id: "st-emma" });
  assert.equal((await deleteStudent(sql, "st-emma", NOW)).ok, false);
}

// ---- Coach deletion --------------------------------------------------------
{
  const blocked = await checkCoachDeletion(sql, DAN, NOW);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error, /1 upcoming lesson/);
  assert.equal((await deactivateCoach(sql, DAN, NOW)).ok, false, "blocked while upcoming lessons exist");
  await pg.exec(`update lessons set status = 'cancelled' where id = 'future'`);

  const ok = await checkCoachDeletion(sql, DAN, NOW);
  assert.deepEqual(ok, { ok: true, stripeAccountId: "acct_1", stripeSubscriptionId: "sub_1", userId: "u-dan" });
  const d = await deactivateCoach(sql, DAN, NOW);
  assert.ok(d.ok);
  if (d.ok) assert.equal(d.purgeAfter.toISOString(), "2031-05-31T12:00:00.000Z");
  const c = await one<Record<string, unknown>>(`select * from coaches where id = $1`, [DAN]);
  assert.equal(c.name, "Deleted coach");
  assert.equal(c.email, `deleted-${DAN}@deleted.invalid`);
  assert.equal(c.slug, `deleted-${DAN}`);
  assert.equal(c.bio, "");
  assert.equal(c.photo_url, null);
  assert.equal(c.stripe_account_id, null, "payouts disconnected");
  assert.equal(c.stripe_subscription_id, null);
  assert.equal(c.subscription_status, "canceled");
  assert.ok(c.deleted_at);
  assert.equal((await sql.query(`select 1 from "session" where "userId" = 'u-dan'`)).length, 0, "signed out everywhere");
  assert.equal((await sql.query(`select 1 from "account" where "userId" = 'u-dan'`)).length, 0, "can't sign in again");
  const u = await one<{ email: string; name: string }>(`select email, name from "user" where id = 'u-dan'`);
  assert.deepEqual(u, { email: `deleted-${DAN}@deleted.invalid`, name: "Deleted coach" });
  assert.equal((await sql.query(`select 1 from device_tokens where coach_id = $1`, [DAN])).length, 0);
  assert.equal((await one<{ address: string }>(`select address from locations where coach_id = $1 limit 1`, [DAN])).address, "");
  assert.equal((await checkCoachDeletion(sql, DAN, NOW)).ok, false, "already deleted");

  // Not yet due
  assert.deepEqual(await purgeDeletedCoaches(sql, new Date("2031-05-30T12:00:00Z")), { purged: 0 });
  assert.ok(await one(`select 1 from "user" where id = 'u-dan'`));

  // Due → purge
  await pg.exec(`insert into clients (id, coach_id, name, email, phone, note) values ('dan-zoe', '${DAN}', 'Zoe', 'zoe@x.test', '777', 'secret')`);
  await pg.exec(`insert into conversations (id, coach_id, client_id) values ('cv-zoe', '${DAN}', 'dan-zoe')`);
  assert.deepEqual(await purgeDeletedCoaches(sql, new Date("2031-05-31T12:00:01Z")), { purged: 1 });
  assert.equal((await sql.query(`select 1 from "user" where id = 'u-dan'`)).length, 0, "auth user hard-deleted");
  const zoe = await one<Record<string, unknown>>(`select name, email, phone, note from clients where id = 'dan-zoe'`);
  assert.deepEqual(zoe, { name: "Former client", email: null, phone: null, note: "" });
  assert.equal((await one<{ note: string }>(`select note from clients where id = 'dan-emma'`)).note, "");
  assert.equal((await sql.query(`select 1 from conversations where coach_id = $1`, [DAN])).length, 0);
  const kept = await one<{ n: number }>(`select count(*)::int n from lessons l join payments p on p.lesson_id = l.id where l.coach_id = $1`, [DAN]);
  assert.equal(Number(kept.n), 1, "lesson + payment records retained");
  const tomb = await one<{ user_id: string | null; purged_at: unknown }>(`select user_id, purged_at from coaches where id = $1`, [DAN]);
  assert.equal(tomb.user_id, null);
  assert.ok(tomb.purged_at);
  assert.deepEqual(await purgeDeletedCoaches(sql, new Date("2031-06-30T12:00:00Z")), { purged: 0 }, "runs once");
  const audit = await one<{ purged_at: unknown }>(`select purged_at from account_deletions where kind = 'coach'`);
  assert.ok(audit.purged_at);
  // Tim is untouched
  assert.equal((await one<{ name: string }>(`select name from coaches where id = $1`, [TIM])).name, "Tim Zhang");
}

// ---- 0009 constraints --------------------------------------------------------
await assert.rejects(
  pg.query(`insert into device_tokens (id, platform, token, coach_id, student_id) values ('bad', 'ios', 'both-owners-token-0000', '${TIM}', 'st-kay')`),
  /check/,
);
await assert.rejects(pg.query(`insert into device_tokens (id, platform, token) values ('none', 'ios', 'no-owner-token-000000')`), /check/);

await pg.close();
console.log("account-deletion tests ok");
