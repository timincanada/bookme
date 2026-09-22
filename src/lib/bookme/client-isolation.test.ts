import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  findOrCreateCoachClient,
  getCoachClient,
  listCoachClientNames,
  listCoachClients,
  saveCoachClientNote,
} from "./clients-db.ts";

const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const before = files.filter((f) => f < "0006");
assert.ok(files.includes("0006_client_isolation.sql"));

async function freshDb(upTo: string[]) {
  const db = new PGlite();
  await db.waitReady;
  for (const f of upTo) {
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(new URL(f, dir), "utf8"));
    });
  }
  return db;
}

function wrap(db: PGlite) {
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows,
  };
}

async function applyIsolation(db: PGlite) {
  await db.transaction(async (tx) => {
    await tx.exec(readFileSync(new URL("0006_client_isolation.sql", dir), "utf8"));
  });
}

const TIM = "coach-tim-zhang";
const DANIEL = "coach-daniel-kim";
const MAYA = "coach-maya-shah";
const SOFIA = "coach-sofia-reyes";
const JAMES = "coach-james-okafor";
const PRIYA = "coach-priya-nair";
const PLACE: Record<string, [string, string]> = {
  [TIM]: ["svc-tim-private", "loc-tim-blackmore"],
  [DANIEL]: ["svc-daniel-private", "loc-daniel-mayfair"],
  [MAYA]: ["svc-maya-pt", "loc-maya-park"],
  [SOFIA]: ["svc-sofia-private", "loc-sofia-maple"],
  [JAMES]: ["svc-james-private", "loc-james-glen"],
  [PRIYA]: ["svc-priya-private", "loc-priya-panam"],
};

async function lesson(db: PGlite, id: string, coach: string, client: string, start: string, status = "confirmed") {
  const [svc, loc] = PLACE[coach];
  const end = new Date(new Date(start).getTime() + 3600_000).toISOString();
  await db.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, coach, svc, loc, client, start, end, status],
  );
}

async function seedHistory(db: PGlite) {
  await db.query(
    `insert into clients (id, name, email, phone, note) values
      ('c-count', 'Emma Chen', 'Emma@X.test', '555', 'emma note'),
      ('c-tie', 'Tia Tie', 'tia@x.test', null, 'tie note'),
      ('c-cxl-multi', 'Cal Multi', 'cal@x.test', '222', 'cal note'),
      ('c-cxl-single', 'Sid Single', 'sid@x.test', null, 'sid note'),
      ('c-done', 'Dora Done', 'dora@x.test', null, 'dora note'),
      ('c-solo', 'Solo Student', 'solo@x.test', null, 'keep me'),
      ('c-first-cxl', 'Fern First', 'fern@x.test', null, 'fern note'),
      ('c-only-cxl', 'Omar Only', 'omar@x.test', '444', 'omar note'),
      ('c-both-cxl', 'Bea Both', 'bea@x.test', '666', 'bea note'),
      ('c-ghost', 'Ghost', 'ghost@x.test', '999', 'orphan note')`,
  );
  // Most valid lessons wins, even though another coach has the earliest (cancelled) one.
  await lesson(db, "count-maya-cxl", MAYA, "c-count", "2025-12-01T15:00:00Z", "cancelled");
  await lesson(db, "count-tim", TIM, "c-count", "2026-01-05T15:00:00Z");
  await lesson(db, "count-dan-1", DANIEL, "c-count", "2026-02-05T15:00:00Z");
  await lesson(db, "count-dan-2", DANIEL, "c-count", "2026-03-05T15:00:00Z");
  // Tie on valid count -> earliest valid lesson; Sofia's earlier cancelled lesson is ignored.
  await lesson(db, "tie-sofia-cxl", SOFIA, "c-tie", "2026-03-01T15:00:00Z", "cancelled");
  await lesson(db, "tie-sofia", SOFIA, "c-tie", "2026-04-02T15:00:00Z");
  await lesson(db, "tie-james", JAMES, "c-tie", "2026-04-01T15:00:00Z");
  // No valid lessons, several coaches -> unattributed, note cleared everywhere.
  await lesson(db, "cm-tim", TIM, "c-cxl-multi", "2026-01-01T15:00:00Z", "cancelled");
  await lesson(db, "cm-priya", PRIYA, "c-cxl-multi", "2026-01-02T15:00:00Z", "expired");
  // Required case 1: earliest lesson is cancelled with A (Tim), confirmed with B (Sofia) -> B keeps the id.
  await lesson(db, "first-tim-cxl", TIM, "c-first-cxl", "2026-01-01T15:00:00Z", "cancelled");
  await lesson(db, "first-sofia", SOFIA, "c-first-cxl", "2026-06-01T15:00:00Z");
  // Required case 2: only ever Tim, every lesson cancelled -> Tim keeps id and note.
  await lesson(db, "only-tim-1", TIM, "c-only-cxl", "2026-01-01T15:00:00Z", "cancelled");
  await lesson(db, "only-tim-2", TIM, "c-only-cxl", "2026-01-08T15:00:00Z", "cancelled");
  // Required case 3: James and Maya, cancelled only (James earliest) -> nobody keeps the id.
  await lesson(db, "both-james", JAMES, "c-both-cxl", "2026-01-01T15:00:00Z", "cancelled");
  await lesson(db, "both-maya", MAYA, "c-both-cxl", "2026-02-01T15:00:00Z", "cancelled");
  // One coach, cancelled + held only -> that coach keeps id and note.
  await lesson(db, "cs-dan-cxl", DANIEL, "c-cxl-single", "2026-01-03T15:00:00Z", "cancelled");
  await lesson(db, "cs-dan-held", DANIEL, "c-cxl-single", "2026-01-04T15:00:00Z", "held");
  // 'completed' counts as valid; three cancelled lessons do not.
  await lesson(db, "done-maya", MAYA, "c-done", "2026-02-01T15:00:00Z", "completed");
  await lesson(db, "done-tim-1", TIM, "c-done", "2026-01-01T15:00:00Z", "cancelled");
  await lesson(db, "done-tim-2", TIM, "c-done", "2026-01-08T15:00:00Z", "cancelled");
  await lesson(db, "done-tim-3", TIM, "c-done", "2026-01-15T15:00:00Z", "cancelled");
  // Single coach with a valid lesson -> keeps id and note.
  await lesson(db, "solo-dan", DANIEL, "c-solo", "2026-01-10T15:00:00Z");
  await db.exec(
    `insert into booking_requests (id, coach_id, kind, lesson_id, other_lesson_id, created_by, student_token, other_token, other_decision)
     values ('r-swap', '${DANIEL}', 'coach_swap', 'count-dan-2', 'solo-dan', 'coach', 'tok-aaaaaaaaaaaaaaaaaaaa', 'tok-bbbbbbbbbbbbbbbbbbbb', 'pending')`,
  );
}

type Row = { id: string; coach_id: string; email: string; note: string; phone: string | null };
async function rowsFor(sql: ReturnType<typeof wrap>, email: string) {
  return sql.query<Row>(
    `select id, coach_id, email, note, phone from clients where lower(email) = $1 order by coach_id`,
    [email],
  );
}
function byCoach(rows: Row[]) {
  return Object.fromEntries(rows.map((r) => [r.coach_id, r]));
}

// ---------------------------------------------------------------------------
// Backfill of pre-existing data
// ---------------------------------------------------------------------------
{
  const db = await freshDb(before);
  await seedHistory(db);
  await applyIsolation(db);
  const sql = wrap(db);
  const lessonClient = Object.fromEntries(
    (await sql.query<{ id: string; client_id: string }>(`select id, client_id from lessons`)).map((l) => [l.id, l.client_id]),
  );

  // Most valid lessons: Daniel keeps the original; Tim (valid) and Maya (cancelled-only) get copies.
  const emma = byCoach(await rowsFor(sql, "emma@x.test"));
  assert.deepEqual(Object.keys(emma).sort(), [DANIEL, MAYA, TIM].sort());
  assert.equal(emma[DANIEL].id, "c-count");
  assert.equal(emma[DANIEL].email, "Emma@X.test", "existing row keeps its email");
  assert.equal(emma[TIM].email, "emma@x.test", "copies store lower-case email");
  assert.equal(emma[MAYA].email, "emma@x.test");
  assert.notEqual(emma[TIM].id, "c-count");
  assert.notEqual(emma[MAYA].id, "c-count");
  for (const r of Object.values(emma)) assert.equal(r.note, "", "multi-coach note cleared");
  assert.equal(emma[TIM].phone, "555", "contact fields copied");
  assert.equal(lessonClient["count-dan-1"], "c-count");
  assert.equal(lessonClient["count-dan-2"], "c-count");
  assert.equal(lessonClient["count-tim"], emma[TIM].id);
  assert.equal(lessonClient["count-maya-cxl"], emma[MAYA].id);

  // Tie -> earliest valid lesson (James), not Sofia's earlier cancelled one.
  const tia = byCoach(await rowsFor(sql, "tia@x.test"));
  assert.equal(tia[JAMES].id, "c-tie");
  assert.notEqual(tia[SOFIA].id, "c-tie");
  assert.equal(lessonClient["tie-sofia"], tia[SOFIA].id);
  assert.equal(lessonClient["tie-sofia-cxl"], tia[SOFIA].id);

  // No valid lessons, several coaches: nobody keeps the original.
  const cal = byCoach(await rowsFor(sql, "cal@x.test"));
  assert.deepEqual(Object.keys(cal).sort(), [PRIYA, TIM].sort());
  assert.ok(cal[TIM].id !== "c-cxl-multi" && cal[PRIYA].id !== "c-cxl-multi");
  assert.equal(cal[TIM].note, "");
  assert.equal(cal[PRIYA].note, "");
  assert.equal(lessonClient["cm-tim"], cal[TIM].id);
  assert.equal(lessonClient["cm-priya"], cal[PRIYA].id);
  assert.equal((await sql.query(`select 1 from clients where id = 'c-cxl-multi'`)).length, 0);

  // One coach, cancelled + held only: that coach keeps the original and the note.
  const sid = byCoach(await rowsFor(sql, "sid@x.test"));
  assert.deepEqual(Object.keys(sid), [DANIEL]);
  assert.equal(sid[DANIEL].id, "c-cxl-single");
  assert.equal(sid[DANIEL].note, "sid note");
  assert.equal(lessonClient["cs-dan-cxl"], "c-cxl-single");
  assert.equal(lessonClient["cs-dan-held"], "c-cxl-single");

  // Required case 1: earliest lesson cancelled with A, confirmed with B -> B keeps the id.
  const fern = byCoach(await rowsFor(sql, "fern@x.test"));
  assert.deepEqual(Object.keys(fern).sort(), [SOFIA, TIM].sort());
  assert.equal(fern[SOFIA].id, "c-first-cxl", "valid lesson wins over an earlier cancelled one");
  assert.notEqual(fern[TIM].id, "c-first-cxl");
  assert.equal(fern[SOFIA].note, "");
  assert.equal(fern[TIM].note, "");
  assert.equal(lessonClient["first-sofia"], "c-first-cxl");
  assert.equal(lessonClient["first-tim-cxl"], fern[TIM].id);

  // Required case 2: only ever A, all cancelled -> A keeps the id and the note (not orphan, not unattributed).
  const omar = byCoach(await rowsFor(sql, "omar@x.test"));
  assert.deepEqual(Object.keys(omar), [TIM]);
  assert.equal(omar[TIM].id, "c-only-cxl");
  assert.equal(omar[TIM].note, "omar note");
  assert.equal(omar[TIM].email, "omar@x.test");
  assert.equal(lessonClient["only-tim-1"], "c-only-cxl");
  assert.equal(lessonClient["only-tim-2"], "c-only-cxl");

  // Required case 3: A and B cancelled only -> original row logged, one copy each, notes empty.
  const bea = byCoach(await rowsFor(sql, "bea@x.test"));
  assert.deepEqual(Object.keys(bea).sort(), [JAMES, MAYA].sort());
  assert.notEqual(bea[JAMES].id, "c-both-cxl", "earliest cancelled lesson does not decide the id");
  assert.notEqual(bea[MAYA].id, "c-both-cxl");
  assert.equal(bea[JAMES].note, "");
  assert.equal(bea[MAYA].note, "");
  assert.equal(bea[JAMES].phone, "666");
  assert.equal(lessonClient["both-james"], bea[JAMES].id);
  assert.equal(lessonClient["both-maya"], bea[MAYA].id);
  assert.equal((await sql.query(`select 1 from clients where id = 'c-both-cxl'`)).length, 0);

  // 'completed' beats three cancelled lessons.
  const dora = byCoach(await rowsFor(sql, "dora@x.test"));
  assert.equal(dora[MAYA].id, "c-done");
  assert.equal(lessonClient["done-tim-2"], dora[TIM].id);

  const solo = await sql.query<{ coach_id: string; note: string }>(`select coach_id, note from clients where id = 'c-solo'`);
  assert.deepEqual(solo[0], { coach_id: DANIEL, note: "keep me" }, "single-coach note is kept");
  assert.equal((await sql.query(`select id from clients where id = 'c-ghost'`)).length, 0);

  // Swap request still joins to both students.
  const swap = await sql.query<{ a: string; b: string }>(
    `select cl.email as a, ocl.email as b from booking_requests r
     join lessons l on l.id = r.lesson_id join clients cl on cl.id = l.client_id
     join lessons o on o.id = r.other_lesson_id join clients ocl on ocl.id = o.client_id`,
  );
  assert.deepEqual(swap[0], { a: "Emma@X.test", b: "solo@x.test" });

  // Log
  const log = await sql.query<{ kind: string; client_id: string; note: string | null; coach_ids: string | null; new_client_id: string | null; phone: string | null }>(
    `select kind, client_id, note, coach_ids, new_client_id, phone from client_migration_log`,
  );
  const kinds = (k: string) => log.filter((r) => r.kind === k);
  assert.deepEqual(
    kinds("shared_note_cleared").map((r) => [r.client_id, r.note, r.coach_ids]).sort(),
    [
      ["c-count", "emma note", [DANIEL, MAYA, TIM].sort().join(",")],
      ["c-cxl-multi", "cal note", [PRIYA, TIM].sort().join(",")],
      ["c-done", "dora note", [MAYA, TIM].sort().join(",")],
      ["c-first-cxl", "fern note", [SOFIA, TIM].sort().join(",")],
      ["c-both-cxl", "bea note", [JAMES, MAYA].sort().join(",")],
      ["c-tie", "tie note", [JAMES, SOFIA].sort().join(",")],
    ].sort(),
  );
  assert.equal(kinds("client_split").length, 2 + 1 + 2 + 1 + 1 + 2, "emma 2, tia 1, cal 2, dora 1, fern 1, bea 2");
  const beaLog = kinds("unattributed_archived").find((r) => r.client_id === "c-both-cxl")!;
  assert.equal(beaLog.phone, "666", "full original row is logged");
  assert.deepEqual(
    kinds("unattributed_archived").map((r) => [r.client_id, r.note]).sort(),
    [["c-both-cxl", ""], ["c-cxl-multi", ""]],
  );
  assert.deepEqual(kinds("orphan_archived").map((r) => [r.client_id, r.note, r.phone]), [["c-ghost", "orphan note", "999"]]);

  const zero = await sql.query<{ n: number }>(
    `select (select count(*) from clients where coach_id is null)
          + (select count(*) from lessons l join clients c on c.id = l.client_id where c.coach_id <> l.coach_id) as n`,
  );
  assert.equal(Number(zero[0].n), 0);

  // Constraints after migration
  await assert.rejects(
    db.query(`insert into clients (id, coach_id, name, email) values ('dup', $1, 'X', 'EMMA@x.test')`, [DANIEL]),
    /clients_coach_email_uidx|duplicate/,
    "same coach, same email (any case) is rejected",
  );
  await assert.rejects(
    lesson(db, "l-cross", DANIEL, emma[TIM].id, "2026-04-01T15:00:00Z"),
    /lessons_client_coach_fkey|foreign key/,
    "a lesson cannot use another coach's client",
  );
  await assert.rejects(
    db.query(`insert into clients (id, name, email) values ('nocoach', 'N', 'n@x.test')`),
    /null/,
    "coach_id is required",
  );

  // Coach-scoped helpers
  const danielList = await listCoachClients(sql, DANIEL);
  assert.deepEqual(danielList.map((c) => c.id).sort(), ["c-count", "c-cxl-single", "c-solo"]);
  assert.equal(danielList.find((c) => c.id === "c-count")!.n, 2);
  assert.equal(await getCoachClient(sql, DANIEL, emma[TIM].id), null, "cannot read another coach's record");
  assert.equal(await saveCoachClientNote(sql, DANIEL, emma[TIM].id, "hijack"), false);
  assert.equal(await saveCoachClientNote(sql, TIM, emma[TIM].id, "tim only"), true);
  assert.equal((await getCoachClient(sql, DANIEL, "c-count"))?.note, "", "other coach's note untouched");
  assert.deepEqual((await listCoachClientNames(sql, JAMES)).map((c) => c.id).sort(), [bea[JAMES].id, "c-tie"].sort());

  // Public booking: existing record keeps name + note, phone only fills when empty.
  const again = await findOrCreateCoachClient(sql, TIM, { id: "unused", name: "Someone Else", email: "EMMA@x.test", phone: "000" });
  assert.deepEqual(again, { id: emma[TIM].id, created: false });
  const afterBook = await getCoachClient(sql, TIM, emma[TIM].id);
  assert.equal(afterBook?.name, "Emma Chen");
  assert.equal(afterBook?.note, "tim only");
  assert.equal((await sql.query<{ phone: string }>(`select phone from clients where id = $1`, [emma[TIM].id]))[0].phone, "555");

  const soloFill = await findOrCreateCoachClient(sql, DANIEL, { id: "x", name: "Changed", email: "SOLO@x.test", phone: "777" });
  assert.equal(soloFill.id, "c-solo");
  const soloRow = await sql.query<{ name: string; phone: string }>(`select name, phone from clients where id = 'c-solo'`);
  assert.deepEqual(soloRow[0], { name: "Solo Student", phone: "777" }, "empty phone filled, name kept");

  // A student already with another coach is simply a new record; stored lower-case.
  const newForTim = await findOrCreateCoachClient(sql, TIM, { id: "c-solo-tim", name: "Solo S.", email: " Solo@X.test " });
  assert.deepEqual(newForTim, { id: "c-solo-tim", created: true });
  assert.equal((await getCoachClient(sql, TIM, "c-solo-tim"))?.email, "solo@x.test");
  assert.equal((await getCoachClient(sql, DANIEL, "c-solo"))?.name, "Solo Student", "other coach untouched");
  await lesson(db, "solo-tim", TIM, "c-solo-tim", "2026-05-01T15:00:00Z");

  // Student portal lookup by (exact) email still spans coaches.
  const portal = await sql.query<{ id: string }>(
    `select l.id from lessons l join clients cl on cl.id = l.client_id where cl.email = $1 order by l.id`,
    ["solo@x.test"],
  );
  assert.deepEqual(portal.map((r) => r.id), ["solo-dan", "solo-tim"]);

  // Deleting a coach still cascades cleanly.
  await db.query(`delete from coaches where id = $1`, [TIM]);
  assert.equal((await sql.query(`select id from clients where coach_id = $1`, [TIM])).length, 0);
  assert.equal((await sql.query(`select id from clients where id = 'c-solo'`)).length, 1);

  await db.close();
}

// ---------------------------------------------------------------------------
// Manual rollback script from the deploy doc: exact round trip, twice
// ---------------------------------------------------------------------------
{
  const doc = readFileSync(new URL("../../../docs/migrations/0006-client-isolation.md", import.meta.url), "utf8");
  const blocks = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
  const down = blocks.find((b) => b.includes("_undo0006"));
  assert.ok(down, "rollback script present in doc");

  const db = await freshDb(before);
  await db.exec(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  await seedHistory(db);
  const snap = async () =>
    JSON.stringify({
      c: (await db.query(`select id, name, email, phone, note from clients order by id`)).rows,
      l: (await db.query(`select id, client_id, coach_id, status from lessons order by id`)).rows,
      r: (await db.query(`select * from booking_requests order by id`)).rows,
    });
  const apply = () =>
    db.transaction(async (tx) => {
      await tx.exec(readFileSync(new URL("0006_client_isolation.sql", dir), "utf8"));
      await tx.query(`insert into _migrations (name) values ('0006_client_isolation.sql')`);
    });

  const s0 = await snap();
  await apply();
  assert.notEqual(await snap(), s0);
  await db.exec(down!);
  assert.equal(await snap(), s0, "rollback restores the pre-0006 state");

  // Edit a shared note after rolling back, re-apply, roll back again: the newest run wins.
  await db.query(`update clients set note = 'cal note v2' where id = 'c-cxl-multi'`);
  const s1 = await snap();
  await new Promise((r) => setTimeout(r, 5));
  await apply();
  await db.exec(down!);
  assert.equal(await snap(), s1, "second rollback uses the latest run only");
  await db.close();
}

// ---------------------------------------------------------------------------
// Same coach, emails differing only by case -> migration aborts, nothing applied
// ---------------------------------------------------------------------------
{
  const db = await freshDb(before);
  await db.query(
    `insert into clients (id, name, email) values ('a', 'A', 'Case@x.test'), ('b', 'B', 'case@x.test')`,
  );
  await lesson(db, "la", TIM, "a", "2026-01-05T15:00:00Z");
  await lesson(db, "lb", TIM, "b", "2026-01-06T15:00:00Z");
  await assert.rejects(applyIsolation(db), /differ only by case/);
  const cols = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_name = 'clients' and column_name = 'coach_id'`,
  );
  assert.equal(cols.rows.length, 0, "failed migration rolls back completely");
  await db.close();
}

// ---------------------------------------------------------------------------
// Empty database: migration applies cleanly (fresh installs / PGLite preview)
// ---------------------------------------------------------------------------
{
  const db = await freshDb(before);
  await applyIsolation(db);
  const log = await db.query(`select 1 from client_migration_log`);
  assert.equal(log.rows.length, 0);
  await db.close();
}

console.log("client-isolation tests ok");
