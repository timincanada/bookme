import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { cleanBody, messageMode, shouldNotify } from "./messages.ts";
import {
  coachIsActive,
  coachThreadContext,
  coachUnreadCount,
  listCoachThreads,
  listStudentThreads,
  loadMessages,
  markRead,
  sendMessage,
  studentThreadContext,
} from "./messages-service.ts";
import { hashSecret } from "./student-auth.ts";
import { createSession, requestCode, revokeSession, sessionFromToken, verifyCode, verifyToken } from "./student-service.ts";

process.env.BETTER_AUTH_SECRET = "test-secret-for-student-portal";

const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
assert.ok(files.includes("0008_student_portal.sql"));
const before8 = files.filter((f) => f < "0008");

async function db(upTo: string[]) {
  const pg = new PGlite();
  await pg.waitReady;
  for (const f of upTo) await pg.transaction(async (tx) => { await tx.exec(readFileSync(new URL(f, dir), "utf8")); });
  // Demo coaches are dev-only since 0010.
  if (upTo.some((f) => f >= "0010")) await pg.exec(readFileSync(new URL("dev/seed.sql", dir), "utf8"));
  return pg;
}
const wrap = (pg: PGlite) => ({ query: async <T>(t: string, p: unknown[] = []) => (await pg.query<T>(t, p)).rows });

const DAN = "coach-daniel-kim";
const TIM = "coach-tim-zhang";
const MAYA = "coach-maya-shah";
const NOW = new Date("2031-03-01T12:00:00Z");
const DAY = 86_400_000;

// ---- 0008 invalidates old codes and sessions ------------------------------
{
  const pg = await db(before8);
  await pg.exec(`
    insert into manage_links (id, email, token, code, expires_at) values ('old', 'a@x.test', 'plain-token', '123456', now() + interval '1 hour');
    insert into student_sessions (id, email, expires_at) values ('old-s', 'a@x.test', now() + interval '1 hour');
  `);
  await pg.transaction(async (tx) => { await tx.exec(readFileSync(new URL("0008_student_portal.sql", dir), "utf8")); });
  const link = (await pg.query<{ used: boolean }>(`select used_at is not null as used from manage_links where id = 'old'`)).rows[0];
  assert.equal(link.used, true, "in-flight plaintext links are invalidated");
  const s = (await pg.query<{ live: boolean }>(`select expires_at > now() as live from student_sessions where id = 'old-s'`)).rows[0];
  assert.equal(s.live, false, "existing sessions are invalidated");
  await pg.close();
}

// ---- Pure rules ------------------------------------------------------------
{
  const base = { hasConversation: false, coachActive: true, studentHasEmail: true, now: NOW };
  assert.deepEqual(messageMode({ ...base, lastValidEnd: null }), { mode: "none", reason: "no_lessons" });
  assert.deepEqual(messageMode({ ...base, lastValidEnd: null, hasConversation: true }), { mode: "read", reason: "no_lessons" });
  assert.equal(messageMode({ ...base, lastValidEnd: new Date(NOW.getTime() - 89 * DAY) }).mode, "send");
  assert.equal(messageMode({ ...base, lastValidEnd: new Date(NOW.getTime() - 90 * DAY) }).mode, "send", "day 90 inclusive");
  assert.deepEqual(messageMode({ ...base, lastValidEnd: new Date(NOW.getTime() - 91 * DAY), hasConversation: true }), { mode: "read", reason: "window_closed" });
  assert.equal(messageMode({ ...base, lastValidEnd: new Date(NOW.getTime() + DAY) }).mode, "send", "future lesson");
  assert.deepEqual(messageMode({ ...base, lastValidEnd: NOW, coachActive: false, hasConversation: true }), { mode: "read", reason: "coach_inactive" });
  assert.deepEqual(messageMode({ ...base, lastValidEnd: NOW, coachActive: false }), { mode: "none", reason: "coach_inactive" });
  assert.equal(messageMode({ ...base, lastValidEnd: NOW, studentHasEmail: false }).mode, "none");
  assert.deepEqual(cleanBody("  hi \r\n there "), { ok: true, body: "hi \n there" });
  assert.equal(cleanBody("   ").ok, false);
  assert.equal(cleanBody("x".repeat(2000)).ok, true);
  assert.equal(cleanBody("x".repeat(2001)).ok, false);
  assert.equal(shouldNotify({ lastReadAt: null, notifiedAt: null, now: NOW }), true);
  assert.equal(shouldNotify({ lastReadAt: null, notifiedAt: new Date(NOW.getTime() - 9 * 60_000), now: NOW }), false);
  assert.equal(shouldNotify({ lastReadAt: null, notifiedAt: new Date(NOW.getTime() - 11 * 60_000), now: NOW }), true);
  assert.equal(shouldNotify({ lastReadAt: new Date(NOW.getTime() - 5 * 60_000), notifiedAt: null, now: NOW }), false, "opened during cooldown");
  assert.equal(coachIsActive({ banned: false, access_grant: "", subscription_status: "active", trial_ends_at: null }), true);
  assert.equal(coachIsActive({ banned: true, access_grant: "paid", subscription_status: "active", trial_ends_at: null }), false);
  assert.equal(coachIsActive({ banned: false, access_grant: "unpaid", subscription_status: "active", trial_ends_at: null }), false);
  assert.equal(coachIsActive({ banned: false, access_grant: "paid", subscription_status: "none", trial_ends_at: null }), true);
  assert.equal(coachIsActive({ banned: false, access_grant: "", subscription_status: "canceled", trial_ends_at: null }), false);
}

const pg = await db(files);
const sql = wrap(pg);
const one = async <T>(t: string, p: unknown[] = []) => (await sql.query<T>(t, p))[0];

await pg.exec(`
  insert into clients (id, coach_id, name, email) values
    ('dan-emma', '${DAN}', 'Emma Chen', 'Emma@X.test'),
    ('tim-emma', '${TIM}', 'Emma C.', 'emma@x.test'),
    ('maya-emma', '${MAYA}', 'Emma', 'emma@x.test'),
    ('dan-kay', '${DAN}', 'Kay Swap', 'kay@x.test'),
    ('dan-nomail', '${DAN}', 'No Mail', null),
    ('tim-ghost', '${TIM}', 'Ghost', 'ghost@x.test'),
    ('maya-done', '${MAYA}', 'Dee Done', 'dee@x.test');
`);
async function lesson(id: string, coach: string, client: string, end: Date, status = "confirmed") {
  const svc = { [DAN]: "svc-daniel-private", [TIM]: "svc-tim-private", [MAYA]: "svc-maya-pt" }[coach];
  const loc = { [DAN]: "loc-daniel-mayfair", [TIM]: "loc-tim-blackmore", [MAYA]: "loc-maya-park" }[coach];
  await sql.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, coach, svc, loc, client, new Date(end.getTime() - 3600_000).toISOString(), end.toISOString(), status],
  );
}
await lesson("d1", DAN, "dan-emma", new Date(NOW.getTime() - 10 * DAY));
await lesson("t1", TIM, "tim-emma", new Date(NOW.getTime() - 120 * DAY), "completed"); // window closed
await lesson("m1", MAYA, "maya-emma", new Date(NOW.getTime() - 5 * DAY), "cancelled"); // cancelled only
await lesson("k1", DAN, "dan-kay", new Date(NOW.getTime() + 3 * DAY));
await lesson("n1", DAN, "dan-nomail", new Date(NOW.getTime() + 3 * DAY));
await lesson("dd1", MAYA, "maya-done", new Date(NOW.getTime() - 20 * DAY), "completed"); // completed counts

// ---- Codes -----------------------------------------------------------------
{
  const unknown = await requestCode(sql, "nobody@x.test", "1.1.1.1", NOW);
  assert.deepEqual(unknown, { issue: false, reason: "unknown" });
  assert.equal((await sql.query(`select 1 from manage_links`)).length, 0, "nothing stored for unknown emails");

  await pg.exec(`insert into clients (id, coach_id, name, email) values ('dan-pad', '${DAN}', 'Padded', '  padded@x.test  ')`);
  const padded = await requestCode(sql, "padded@x.test", "4.4.4.4", NOW);
  assert.ok(padded.issue, "stored email with surrounding spaces still gets a code");

  const r = await requestCode(sql, "  EMMA@x.TEST ", "1.1.1.1", NOW);
  assert.ok(r.issue);
  if (!r.issue) throw new Error();
  assert.equal(r.email, "emma@x.test");
  const row = await one<{ code: string | null; token: string | null; code_hash: string; token_hash: string }>(
    `select code, token, code_hash, token_hash from manage_links where email = 'emma@x.test'`,
  );
  assert.equal(row.code, null, "no plaintext code");
  assert.equal(row.token, null, "no plaintext token");
  assert.notEqual(row.code_hash, r.code);
  assert.equal(row.code_hash, hashSecret("code", r.code));

  // wrong codes: 4 fail, 5th wrong invalidates; the right code no longer works
  for (let i = 0; i < 4; i++) assert.equal((await verifyCode(sql, "emma@x.test", "000000", NOW)).ok, false);
  const wrong = r.code === "999999" ? "999998" : "999999";
  assert.equal((await verifyCode(sql, "emma@x.test", wrong, NOW)).ok, false);
  assert.equal((await verifyCode(sql, "emma@x.test", r.code, NOW)).ok, false, "5 wrong attempts invalidate the code");

  // fresh code works once, case-insensitively; old link token invalid after new request
  const r2 = await requestCode(sql, "emma@x.test", "1.1.1.1", NOW);
  assert.ok(r2.issue);
  if (!r2.issue) throw new Error();
  assert.equal((await verifyToken(sql, r.token, NOW)).ok, false, "earlier link was superseded");
  const ok = await verifyCode(sql, "Emma@X.Test", r2.code, NOW);
  assert.ok(ok.ok);
  assert.equal((await verifyCode(sql, "emma@x.test", r2.code, NOW)).ok, false, "single use");
  assert.equal((await verifyToken(sql, r2.token, NOW)).ok, false, "code and link share one use");

  // expiry
  const r3 = await requestCode(sql, "emma@x.test", "1.1.1.1", NOW);
  assert.ok(r3.issue);
  if (r3.issue) {
    assert.equal((await verifyToken(sql, r3.token, new Date(NOW.getTime() + 31 * 60_000))).ok, false, "30-minute expiry");
  }

  // per-email cap: 5 per hour (3 issued so far + 2 more)
  assert.ok((await requestCode(sql, "emma@x.test", "2.2.2.2", NOW)).issue);
  const r5 = await requestCode(sql, "emma@x.test", "2.2.2.2", NOW);
  assert.ok(r5.issue);
  assert.deepEqual(await requestCode(sql, "emma@x.test", "3.3.3.3", NOW), { issue: false, reason: "rate_email" });
  assert.ok((await requestCode(sql, "emma@x.test", "3.3.3.3", new Date(NOW.getTime() + 61 * 60_000))).issue, "window rolls");

  // per-IP cap: 20 per hour across emails
  await pg.exec(`insert into manage_links (id, email, expires_at, request_ip, created_at)
    select 'ip-' || g, 'x' || g || '@x.test', now(), '9.9.9.9', '${NOW.toISOString()}' from generate_series(1, 20) g`);
  assert.deepEqual(await requestCode(sql, "kay@x.test", "9.9.9.9", NOW), { issue: false, reason: "rate_ip" });
  assert.ok((await requestCode(sql, "kay@x.test", "8.8.8.8", NOW)).issue);

  // link login
  const r6 = await requestCode(sql, "ghost@x.test", null, NOW);
  assert.ok(r6.issue);
  if (r6.issue) {
    const v = await verifyToken(sql, r6.token, NOW);
    assert.ok(v.ok && v.email === "ghost@x.test");
  }

  // one student per email
  assert.equal(Number((await one<{ n: number }>(`select count(*)::int as n from students where lower(email) = 'emma@x.test'`)).n), 1);
}

// ---- Sessions --------------------------------------------------------------
const emma = await one<{ id: string }>(`select id from students where lower(email) = 'emma@x.test'`);
{
  const s = await createSession(sql, emma.id, "emma@x.test", NOW);
  assert.equal(Math.round((s.expires.getTime() - NOW.getTime()) / DAY), 30);
  const stored = await one<{ token_hash: string }>(`select token_hash from student_sessions where student_id = $1`, [emma.id]);
  assert.notEqual(stored.token_hash, s.token);
  assert.deepEqual(await sessionFromToken(sql, s.token, NOW), { studentId: emma.id, email: "emma@x.test" });
  assert.equal(await sessionFromToken(sql, s.token, new Date(NOW.getTime() + 31 * DAY)), null, "30-day expiry");
  assert.equal(await sessionFromToken(sql, "bogus-token-bogus-token", NOW), null);
  assert.equal(await sessionFromToken(sql, stored.token_hash, NOW), null, "the stored hash is not a usable token");
  await revokeSession(sql, s.token, NOW);
  assert.equal(await sessionFromToken(sql, s.token, NOW), null, "sign-out revokes");
}

// ---- Messaging ---------------------------------------------------------------
{
  const threads = await listStudentThreads(sql, "EMMA@x.test", NOW);
  assert.deepEqual(threads.map((t) => [t.coachId, t.mode]), [[DAN, "send"]], "only eligible coaches; cancelled-only and closed windows hidden");

  const dctx = (await studentThreadContext(sql, "emma@x.test", DAN, NOW))!;
  assert.equal(dctx.mode, "send");
  assert.equal(dctx.clientId, "dan-emma", "matches Daniel's record despite mixed case");
  assert.equal((await studentThreadContext(sql, "emma@x.test", MAYA, NOW))!.mode, "none");
  assert.equal((await studentThreadContext(sql, "emma@x.test", TIM, NOW))!.mode, "none");
  assert.equal(await studentThreadContext(sql, "nobody@x.test", DAN, NOW), null);
  assert.equal((await sendMessage(sql, (await studentThreadContext(sql, "emma@x.test", MAYA, NOW))!, { role: "student", studentId: emma.id }, "hi", NOW)).ok, false);

  // first student message creates the thread and notifies the coach
  const s1 = await sendMessage(sql, dctx, { role: "student", studentId: emma.id }, " Hello coach ", NOW);
  assert.ok(s1.ok);
  if (!s1.ok) throw new Error();
  assert.deepEqual(s1.notify, { role: "coach", email: "daniel@bookme.test", name: "Daniel Kim", fromName: "Emma Chen" });
  assert.equal(await coachUnreadCount(sql, DAN), 1);
  // second message within cooldown: no email
  const s2 = await sendMessage(sql, (await coachThreadContext(sql, DAN, "dan-emma", NOW))!, { role: "student", studentId: emma.id }, "Still there?", new Date(NOW.getTime() + 60_000));
  assert.ok(s2.ok && s2.notify === null);
  assert.equal(await coachUnreadCount(sql, DAN), 2);

  // coach reads and replies; student gets one email; coach unread resets
  const cctx = (await coachThreadContext(sql, DAN, "dan-emma", NOW))!;
  await markRead(sql, cctx.conversationId, "coach", new Date(NOW.getTime() + 2 * 60_000));
  assert.equal(await coachUnreadCount(sql, DAN), 0);
  // The student sent a message at NOW (counts as having the thread open) → a reply within 10 min sends no email.
  const early = await sendMessage(sql, cctx, { role: "coach" }, "On it", new Date(NOW.getTime() + 3 * 60_000));
  assert.ok(early.ok && early.notify === null);
  const c1 = await sendMessage(sql, cctx, { role: "coach" }, "Hi Emma", new Date(NOW.getTime() + 11 * 60_000));
  assert.ok(c1.ok && c1.notify?.role === "student" && c1.notify.email === "Emma@X.test");
  const threads2 = await listStudentThreads(sql, "emma@x.test", NOW);
  assert.equal(threads2[0].unread, 2);

  // student opened the thread recently → coach's next message sends no email even after coach cooldown
  await markRead(sql, cctx.conversationId, "student", new Date(NOW.getTime() + 12 * 60_000));
  const c2 = await sendMessage(sql, (await coachThreadContext(sql, DAN, "dan-emma", NOW))!, { role: "coach" }, "See you", new Date(NOW.getTime() + 15 * 60_000));
  assert.ok(c2.ok && c2.notify === null);
  const c3 = await sendMessage(sql, (await coachThreadContext(sql, DAN, "dan-emma", NOW))!, { role: "coach" }, "Bring water", new Date(NOW.getTime() + 40 * 60_000));
  assert.ok(c3.ok && c3.notify?.role === "student", "after cooldown and no recent read → email again");

  // a completed lesson inside the window opens messaging
  assert.equal((await studentThreadContext(sql, "dee@x.test", MAYA, NOW))!.mode, "send");
  assert.equal((await coachThreadContext(sql, MAYA, "maya-done", NOW))!.mode, "send");

  // cursor pagination
  const all = await loadMessages(sql, cctx.conversationId);
  assert.deepEqual(all.messages.map((m) => [m.role, m.body]), [
    ["student", "Hello coach"],
    ["student", "Still there?"],
    ["coach", "On it"],
    ["coach", "Hi Emma"],
    ["coach", "See you"],
    ["coach", "Bring water"],
  ]);
  const page = await loadMessages(sql, cctx.conversationId, `${all.messages[3].createdAt}|${all.messages[3].id}`);
  assert.deepEqual(page.messages.map((m) => m.body), ["See you", "Bring water"]);
  const empty = await loadMessages(sql, cctx.conversationId, all.cursor);
  assert.deepEqual(empty.messages, []);
  assert.equal(empty.cursor, all.cursor);

  // coach list, scoping
  assert.deepEqual((await listCoachThreads(sql, DAN, NOW)).map((t) => t.clientId), ["dan-emma"]);
  assert.deepEqual(await listCoachThreads(sql, TIM, NOW), []);
  assert.equal(await coachThreadContext(sql, TIM, "dan-emma", NOW), null, "coach can't reach another coach's client");

  // coach may start with an eligible student (P2); not with a no-email client
  const kctx = (await coachThreadContext(sql, DAN, "dan-kay", NOW))!;
  assert.equal(kctx.mode, "send");
  assert.ok((await sendMessage(sql, kctx, { role: "coach" }, "Welcome", NOW)).ok);
  const nctx = (await coachThreadContext(sql, DAN, "dan-nomail", NOW))!;
  assert.deepEqual([nctx.mode, nctx.reason], ["none", "no_email"]);
  assert.equal((await sendMessage(sql, nctx, { role: "coach" }, "x", NOW)).ok, false);

  // rate limit: 20 per minute per sender
  const t0 = new Date(NOW.getTime() + 2 * DAY);
  let sent = 0;
  for (let i = 0; i < 21; i++) {
    const r = await sendMessage(sql, (await coachThreadContext(sql, DAN, "dan-kay", t0))!, { role: "coach" }, `m${i}`, new Date(t0.getTime() + i * 1000));
    if (r.ok) sent++;
    else assert.match(r.error, /too quickly/);
  }
  assert.equal(sent, 20);

  // body limits enforced by DB too
  await assert.rejects(
    pg.query(`insert into messages (id, conversation_id, sender_role, body) values ('x', $1, 'coach', '')`, [cctx.conversationId]),
    /check/,
  );
  await assert.rejects(
    pg.query(`insert into messages (id, conversation_id, sender_role, body) values ('y', $1, 'student', 'hi')`, [cctx.conversationId]),
    /check/,
    "student messages must carry the student id",
  );

  // window closes 90 days after the last valid lesson → read-only; a new booking reopens
  const later = new Date(NOW.getTime() + 81 * DAY); // last lesson ended NOW-10d → day 91
  const closed = (await studentThreadContext(sql, "emma@x.test", DAN, later))!;
  assert.deepEqual([closed.mode, closed.reason], ["read", "window_closed"]);
  assert.equal((await coachThreadContext(sql, DAN, "dan-emma", later))!.mode, "read", "symmetric for the coach");
  assert.equal((await sendMessage(sql, closed, { role: "student", studentId: emma.id }, "hi", later)).ok, false);
  assert.deepEqual((await listStudentThreads(sql, "emma@x.test", later)).map((t) => t.mode), ["read"]);
  await lesson("d2", DAN, "dan-emma", new Date(later.getTime() + 7 * DAY));
  assert.equal((await studentThreadContext(sql, "emma@x.test", DAN, later))!.mode, "send");

  // banned / lapsed coach → both sides read-only, no new threads
  await pg.exec(`update coaches set banned = true where id = '${DAN}'`);
  assert.equal((await studentThreadContext(sql, "emma@x.test", DAN, NOW))!.mode, "read");
  assert.equal((await coachThreadContext(sql, DAN, "dan-emma", NOW))!.mode, "read");
  await pg.exec(`update coaches set banned = false, access_grant = '', subscription_status = 'canceled' where id = '${DAN}'`);
  assert.equal((await coachThreadContext(sql, DAN, "dan-emma", NOW))!.mode, "read");
  await pg.exec(`update clients set name = name where id = 'dan-kay'`);
  await pg.exec(`delete from conversations where client_id = 'dan-kay'`);
  assert.equal((await coachThreadContext(sql, DAN, "dan-kay", NOW))!.mode, "none", "no new thread with a lapsed coach");
}

await pg.close();
console.log("student-portal tests ok");
