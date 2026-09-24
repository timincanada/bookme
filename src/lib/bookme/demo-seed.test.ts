import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { verifyPassword } from "better-auth/crypto";
import type { Sql } from "@/lib/db";
import { DEMO_COACH, DEMO_VENUE } from "./demo.ts";

// Importing api.ts loads the DB module, which boots PGLite via import.meta.glob.
// A dummy DATABASE_URL keeps that bootstrap on the Neon path (no connection
// until getSql), so this test can drive ensureDemoReady with its own PGLite.
process.env.DATABASE_URL ??= "postgres://127.0.0.1:1/bookme_demo_seed_test";
const { ensureDemoReady } = await import("./api.ts");

const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const WINDOW_MS = 72 * 60 * 60 * 1000;

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  BOOKME_ALLOW_DEMO: process.env.BOOKME_ALLOW_DEMO,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

function setEnv(env: { NODE_ENV?: string; BOOKME_ALLOW_DEMO?: string; VERCEL_ENV?: string }) {
  if (env.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = env.NODE_ENV;
  if (env.BOOKME_ALLOW_DEMO === undefined) delete process.env.BOOKME_ALLOW_DEMO;
  else process.env.BOOKME_ALLOW_DEMO = env.BOOKME_ALLOW_DEMO;
  if (env.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = env.VERCEL_ENV;
}

async function fresh() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const file of files) {
    await pg.transaction(async (tx) => {
      await tx.exec(readFileSync(new URL(file, dir), "utf8"));
    });
  }
  const sql = {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
  return sql as Sql;
}

async function demoRow(sql: Awaited<ReturnType<typeof fresh>>) {
  const rows = await sql.query<{
    slug: string;
    deleted_at: string | null;
    emailVerified: boolean;
    password: string;
    lat: number | null;
    lng: number | null;
    locations: number;
  }>(
    `select c.slug, c.deleted_at, u."emailVerified", a.password, loc.lat, loc.lng,
            (select count(*)::int from locations where coach_id = c.id) as locations
       from coaches c
       join "user" u on u.id = c.user_id
       join "account" a on a."userId" = u.id and a."providerId" = 'credential'
       left join locations loc on loc.coach_id = c.id and loc.kind <> 'online'
      where u.email = $1
      limit 1`,
    [DEMO_COACH.email],
  );
  return rows[0];
}

async function hasWindowLesson(sql: Awaited<ReturnType<typeof fresh>>) {
  const rows = await sql.query<{ start_at: string; lat: number | null; lng: number | null }>(
    `select l.start_at, loc.lat, loc.lng
       from lessons l
       join locations loc on loc.id = l.location_id
       join coaches c on c.id = l.coach_id
       join "user" u on u.id = c.user_id
      where u.email = $1 and l.status = 'confirmed'`,
    [DEMO_COACH.email],
  );
  const now = Date.now();
  return rows.some((row) => {
    const delta = new Date(row.start_at).getTime() - now;
    return delta > 0 && delta <= WINDOW_MS && row.lat != null && row.lng != null;
  });
}

try {
  setEnv({ NODE_ENV: "production" });
  const blocked = await fresh();
  assert.equal(await ensureDemoReady(blocked), undefined);
  assert.equal((await blocked.query(`select id from "user" where email = $1`, [DEMO_COACH.email])).length, 0);

  setEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" });
  const seeded = await ensureDemoReady(blocked);
  assert.equal(seeded?.slug, "alex");
  const created = await demoRow(blocked);
  assert.equal(created.emailVerified, true);
  assert.equal(created.slug, "alex");
  assert.equal(created.deleted_at, null);
  assert.equal(Number(created.lat), DEMO_VENUE.lat);
  assert.equal(Number(created.lng), DEMO_VENUE.lng);
  assert.equal(created.locations, 1);
  assert.equal(await verifyPassword({ hash: created.password, password: DEMO_COACH.password }), true);
  assert.equal(await hasWindowLesson(blocked), true);

  const again = await ensureDemoReady(blocked);
  assert.equal(again?.slug, "alex");
  const second = await demoRow(blocked);
  assert.equal(second.password, created.password, "verified demo password is left alone");
  assert.equal(second.locations, 1);

  const repairDb = await fresh();
  await repairDb.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values ('u-demo', 'Alex', $1, false, now(), now())`,
    [DEMO_COACH.email],
  );
  await repairDb.query(
    `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     values ('a-demo', 'u-demo', 'credential', 'u-demo', 'not-the-demo-password', now(), now())`,
  );
  await repairDb.query(
    `insert into coaches (id, user_id, slug, name, email, deleted_at, subscription_status, plan)
     values ('c-demo', 'u-demo', 'rivera', 'Alex', $1, now(), 'none', 'none')`,
    [DEMO_COACH.email],
  );
  await repairDb.query(
    `insert into locations (id, coach_id, name, address, kind, active)
     values ('loc-demo', 'c-demo', 'Mayfair Parkway', '50 Steelcase Rd, Markham', 'in_person', true)`,
  );
  const repaired = await ensureDemoReady(repairDb);
  assert.equal(repaired?.slug, "alex");
  const fixed = await demoRow(repairDb);
  assert.equal(fixed.emailVerified, true);
  assert.equal(fixed.slug, "alex");
  assert.equal(fixed.deleted_at, null);
  assert.equal(Number(fixed.lat), DEMO_VENUE.lat);
  assert.equal(Number(fixed.lng), DEMO_VENUE.lng);
  assert.equal(fixed.locations, 1);
  assert.equal(await verifyPassword({ hash: fixed.password, password: DEMO_COACH.password }), true);
  assert.equal(await hasWindowLesson(repairDb), true);

  const takenDb = await fresh();
  await takenDb.query(
    `insert into coaches (id, slug, name, email) values ('other', 'alex', 'Other Coach', 'other@x.test')`,
  );
  const taken = await ensureDemoReady(takenDb);
  assert.notEqual(taken?.slug, "alex");
  const owner = await takenDb.query<{ slug: string }>(`select slug from coaches where id = 'other'`);
  assert.equal(owner[0]?.slug, "alex");
  const moved = await demoRow(takenDb);
  assert.equal(Number(moved.lat), DEMO_VENUE.lat);
  assert.equal(Number(moved.lng), DEMO_VENUE.lng);
  assert.equal(await hasWindowLesson(takenDb), true);
} finally {
  setEnv(saved);
}
