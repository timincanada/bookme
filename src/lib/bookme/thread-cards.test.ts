import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadThreadCards } from "./thread-cards.ts";
import { formatTime, formatWhen } from "./time.ts";

const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const pg = new PGlite();
await pg.waitReady;
for (const f of files) {
  await pg.transaction(async (tx) => {
    await tx.exec(readFileSync(new URL(f, dir), "utf8"));
  });
}
if (files.some((f) => f >= "0010"))
  await pg.exec(readFileSync(new URL("dev/seed.sql", dir), "utf8"));
const sql = { query: async <T>(t: string, p: unknown[] = []) => (await pg.query<T>(t, p)).rows };

const DAN = "coach-daniel-kim";
const TIM = "coach-tim-zhang";
const NOW = new Date("2031-03-01T12:00:00Z");
const TZ = "America/Toronto";
const EMMA_START = new Date("2031-03-02T15:00:00Z");
const KAY_START = new Date("2031-03-03T18:00:00Z");
const LATER = new Date("2031-03-10T15:00:00Z");
const PROPOSED = new Date("2031-03-04T16:00:00Z");

await sql.query(
  `insert into clients (id, coach_id, name, email) values
     ('dan-emma', $1, 'Emma Chen', 'Emma@X.test'),
     ('dan-kay', $1, 'Kay Swap', 'kay@x.test'),
     ('tim-emma', $2, 'Emma Chen', 'emma@x.test')`,
  [DAN, TIM],
);

async function lesson(
  id: string,
  coach: string,
  client: string,
  start: Date,
  status = "confirmed",
  loc = "loc-daniel-mayfair",
) {
  const end = new Date(start.getTime() + 3600_000);
  const svc = coach === TIM ? "svc-tim-private" : "svc-daniel-private";
  await sql.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, coach, svc, loc, client, start.toISOString(), end.toISOString(), status],
  );
}

await lesson("past", DAN, "dan-emma", new Date("2031-02-01T15:00:00Z"));
await lesson("cancelled", DAN, "dan-emma", LATER, "cancelled");
await lesson("emma-next", DAN, "dan-emma", EMMA_START);
await lesson("emma-later", DAN, "dan-emma", LATER);
await lesson("kay-next", DAN, "dan-kay", KAY_START);
await lesson(
  "emma-online",
  DAN,
  "dan-emma",
  new Date("2031-04-01T15:00:00Z"),
  "confirmed",
  "loc-daniel-online",
);
await lesson("tim-next", TIM, "tim-emma", EMMA_START, "confirmed", "loc-tim-blackmore");

{
  const none = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "missing" },
    NOW,
  );
  assert.deepEqual(none, { pending: null, booking: null });
}

{
  const cards = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "dan-emma" },
    NOW,
  );
  assert.equal(cards.pending, null);
  assert.equal(cards.booking?.id, "emma-next", "soonest upcoming, not a past or cancelled lesson");
  assert.equal(
    cards.booking?.dateLabel,
    EMMA_START.toLocaleDateString("en-CA", {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  );
  assert.equal(cards.booking?.timeLabel, formatTime(EMMA_START, TZ));
  assert.equal(cards.booking?.place, "Mayfair Parkway");
}

{
  const student = await loadThreadCards(
    sql,
    { viewer: "student", coachId: DAN, email: "EMMA@x.test" },
    NOW,
  );
  assert.equal(student.booking?.id, "emma-next");
  assert.equal(student.booking?.place, "Mayfair Parkway");
  assert.equal(student.booking?.timeLabel, formatTime(EMMA_START, TZ));
  const otherCoach = await loadThreadCards(
    sql,
    { viewer: "student", coachId: TIM, email: "emma@x.test" },
    NOW,
  );
  assert.equal(otherCoach.booking?.id, "tim-next");
  assert.equal(otherCoach.booking?.place, "Blackmore Tennis Club");
}

await sql.query(
  `insert into booking_requests
     (id, coach_id, kind, status, lesson_id, proposed_start, created_by, student_decision, created_at)
   values ('move-1', $1, 'student_move', 'pending', 'emma-next', $2, 'student', 'pending', $3)`,
  [DAN, PROPOSED.toISOString(), new Date(NOW.getTime() - 86_400_000).toISOString()],
);

{
  const cards = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "dan-emma" },
    NOW,
  );
  assert.equal(cards.pending?.kind, "student_move");
  assert.equal(cards.pending?.lines[0], `Emma Chen · ${formatWhen(EMMA_START, TZ)}`);
  assert.equal(cards.pending?.lines[1], `Proposed · ${formatWhen(PROPOSED, TZ)}`);
  assert.equal(cards.booking?.id, "emma-next", "move stacks with the next booking");
  const student = await loadThreadCards(
    sql,
    { viewer: "student", coachId: DAN, email: "emma@x.test" },
    NOW,
  );
  assert.equal(student.pending?.lines[0], `Your lesson · ${formatWhen(EMMA_START, TZ)}`);
  assert.equal(student.pending?.lines[1], `Proposed · ${formatWhen(PROPOSED, TZ)}`);
}

await sql.query(
  `insert into booking_requests
     (id, coach_id, kind, status, lesson_id, other_lesson_id, created_by, student_decision, other_decision, created_at)
   values ('swap-1', $1, 'coach_swap', 'pending', 'emma-next', 'kay-next', 'coach', 'pending', 'pending', $2)`,
  [DAN, NOW.toISOString()],
);
await sql.query(
  `insert into booking_requests
     (id, coach_id, kind, status, lesson_id, other_lesson_id, created_by)
   values ('swap-dead', $1, 'coach_swap', 'pending', 'cancelled', 'kay-next', 'coach')`,
  [DAN],
);
await sql.query(
  `insert into booking_requests
     (id, coach_id, kind, status, lesson_id, other_lesson_id, created_by)
   values ('swap-done', $1, 'coach_swap', 'declined', 'emma-later', 'kay-next', 'coach')`,
  [DAN],
);

{
  const coach = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "dan-emma" },
    NOW,
  );
  assert.equal(
    coach.pending?.id,
    "swap-1",
    "open swap wins over a move, and dead or declined swaps are skipped",
  );
  assert.equal(coach.pending?.kind, "coach_swap");
  assert.equal(coach.pending?.lines[0], `Emma Chen · ${formatWhen(EMMA_START, TZ)}`);
  assert.equal(coach.pending?.lines[1], `Kay Swap · ${formatWhen(KAY_START, TZ)}`);
  assert.equal(coach.booking?.id, "emma-next");

  const emma = await loadThreadCards(
    sql,
    { viewer: "student", coachId: DAN, email: "emma@x.test" },
    NOW,
  );
  assert.equal(emma.pending?.lines[0], `Your lesson · ${formatWhen(EMMA_START, TZ)}`);
  assert.equal(emma.pending?.lines[1], `Another student · ${formatWhen(KAY_START, TZ)}`);
  assert.equal(JSON.stringify(emma).includes("Kay"), false);

  const kay = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "dan-kay" },
    NOW,
  );
  assert.equal(kay.pending?.id, "swap-1", "the other party of the swap sees it too");
  assert.equal(kay.booking?.id, "kay-next");
  assert.equal(kay.pending?.lines[0], `Emma Chen · ${formatWhen(EMMA_START, TZ)}`);

  const kayStudent = await loadThreadCards(
    sql,
    { viewer: "student", coachId: DAN, email: "kay@x.test" },
    NOW,
  );
  assert.equal(kayStudent.pending?.lines[0], `Your lesson · ${formatWhen(KAY_START, TZ)}`);
  assert.equal(kayStudent.pending?.lines[1], `Another student · ${formatWhen(EMMA_START, TZ)}`);
  assert.equal(JSON.stringify(kayStudent).includes("Emma"), false);

  const tim = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: TIM, clientId: "tim-emma" },
    NOW,
  );
  assert.equal(tim.pending, null, "another coach's swap stays hidden");
  assert.equal(tim.booking?.id, "tim-next");
}

{
  await sql.query(`update lessons set status = 'cancelled' where id = 'emma-next'`);
  await sql.query(`update lessons set status = 'cancelled' where id = 'emma-later'`);
  await sql.query(`delete from lessons where id = 'emma-online'`);
  const after = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "dan-emma" },
    NOW,
  );
  assert.equal(after.pending, null, "a swap of a cancelled lesson is not shown");
  assert.equal(after.booking, null);
}

{
  await lesson(
    "held-online",
    DAN,
    "dan-kay",
    new Date("2031-03-05T20:00:00Z"),
    "held",
    "loc-daniel-online",
  );
  const kay = await loadThreadCards(
    sql,
    { viewer: "coach", coachId: DAN, clientId: "dan-kay" },
    NOW,
  );
  assert.equal(kay.booking?.id, "kay-next", "confirmed lesson still beats a later hold");
  await sql.query(`update lessons set status = 'cancelled' where id = 'kay-next'`);
  const held = await loadThreadCards(
    sql,
    { viewer: "student", coachId: DAN, email: "kay@x.test" },
    NOW,
  );
  assert.equal(held.booking?.id, "held-online");
  assert.equal(held.booking?.place, "Online");
}

await pg.close();
