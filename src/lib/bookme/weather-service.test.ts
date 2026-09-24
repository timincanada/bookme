import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  alignExtremeFixture,
  openAskAsStudent,
  resetWeatherForTests,
  resolveAskAsCoach,
  resolveOpenMeteoFixture,
  setGeocodeTransport,
  setWeatherTransport,
  weatherForCoach,
  weatherForStudent,
  weatherForVenue,
  weatherSnippetForLesson,
} from "./weather-service.ts";

const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
assert.ok(files.includes("0014_weather_asks.sql"));

const pg = new PGlite();
await pg.waitReady;
for (const f of files) {
  await pg.transaction(async (tx) => {
    await tx.exec(readFileSync(new URL(f, dir), "utf8"));
  });
}
if (files.some((f) => f >= "0010")) await pg.exec(readFileSync(new URL("dev/seed.sql", dir), "utf8"));
const sql = { query: async <T>(t: string, p: unknown[] = []) => (await pg.query<T>(t, p)).rows };

const DAN = "coach-daniel-kim";
const NOW = new Date("2031-06-01T15:00:00Z");
const START = new Date("2031-06-02T15:00:00Z");
const LATER = new Date(START.getTime() + 30 * 60 * 60 * 1000);
const FAR = new Date(NOW.getTime() + 80 * 60 * 60 * 1000);
const HOUR = 60 * 60 * 1000;
const coach = { id: DAN, name: "Daniel Kim", email: "daniel@bookme.test", timezone: "America/Toronto" };

await sql.query(
  `insert into clients (id, coach_id, name, email) values ('wx-emma', $1, 'Emma Chen', 'emma-wx@x.test')`,
  [DAN],
);
await sql.query(
  `insert into locations (id, coach_id, name, address, kind, active, lat, lng) values
     ('loc-wx', $1, 'Mayfair Parkway', 'Markham, ON', 'in_person', true, 43.85, -79.33)`,
  [DAN],
);
await sql.query(
  `insert into locations (id, coach_id, name, address, kind, active) values
     ('loc-wx-blank', $1, 'Blank Club', '100 Main St, Markham', 'in_person', true),
     ('loc-wx-place', $1, 'Places Club', '200 Main St, Markham', 'in_person', true)`,
  [DAN],
);
await sql.query(`update locations set place_id = 'place-123' where id = 'loc-wx-place'`);

async function lesson(id: string, start: Date, loc = "loc-wx", status = "confirmed") {
  await sql.query(
    `insert into lessons (id, coach_id, service_id, location_id, client_id, start_at, end_at, status)
     values ($1,$2,'svc-daniel-private',$3,'wx-emma',$4,$5,$6)`,
    [id, DAN, loc, start.toISOString(), new Date(start.getTime() + HOUR).toISOString(), status],
  );
}

function meteo(hours: Array<{ at: number; temp?: number; pop?: number; mm?: number; wind?: number; gust?: number; code?: number; app?: number }>) {
  return {
    hourly: {
      time: hours.map((row) => Math.floor((NOW.getTime() + row.at * HOUR) / 1000)),
      temperature_2m: hours.map((row) => row.temp ?? 18),
      apparent_temperature: hours.map((row) => row.app ?? row.temp ?? 18),
      precipitation_probability: hours.map((row) => row.pop ?? 10),
      precipitation: hours.map((row) => row.mm ?? 0),
      wind_speed_10m: hours.map((row) => row.wind ?? 12),
      wind_gusts_10m: hours.map((row) => row.gust ?? 18),
      weather_code: hours.map((row) => row.code ?? 1),
    },
  };
}

const span = (patch?: (at: number) => { temp?: number; pop?: number; code?: number }) =>
  Array.from({ length: 72 }, (_, at) => ({ at, ...patch?.(at) }));
const mildHours = span();
const stormAtSoon = span((at) => (at === 24 ? { pop: 80, code: 95 } : {}));
const rainSpan = span(() => ({ pop: 90, code: 2, temp: 20 }));

function installMeteo(body: unknown) {
  resetWeatherForTests();
  let calls = 0;
  setWeatherTransport(async () => {
    calls += 1;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  setGeocodeTransport(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  return () => calls;
}

await lesson("wx-soon", START);
await lesson("wx-later", LATER);
await lesson("wx-far", FAR);
await lesson("wx-past", new Date(NOW.getTime() - 2 * HOUR));
await lesson("wx-held", new Date(NOW.getTime() + 5 * HOUR), "loc-wx", "held");
await lesson("wx-online", new Date(NOW.getTime() + 6 * HOUR), "loc-daniel-online");
await lesson("wx-blank", new Date(NOW.getTime() + 8 * HOUR), "loc-wx-blank");
await sql.query(
  `insert into payments (id, lesson_id, method, status, amount_cad) values ('pay-wx', 'wx-soon', 'card', 'paid', 85)`,
);

{
  const calls = installMeteo(meteo(stormAtSoon));
  const views = await weatherForCoach(sql, DAN, NOW);
  const ids = views.map((v) => v.lessonId).sort();
  assert.deepEqual(ids, ["wx-later", "wx-soon"]);
  assert.equal(calls(), 1, "one Open-Meteo fetch for lessons at the same coordinates");
  const soon = views.find((v) => v.lessonId === "wx-soon")!;
  const later = views.find((v) => v.lessonId === "wx-later")!;
  assert.equal(soon.extreme, true);
  assert.equal(soon.summary, "18° · 80%");
  assert.equal(soon.icon, "thunder");
  assert.equal(soon.headline, "Forecast may affect an outdoor lesson");
  assert.equal(soon.signal, "Thunderstorm in the forecast");
  assert.equal(soon.ask, null);
  assert.equal(later.extreme, false);
  assert.equal(later.summary.includes("°"), true);
  const again = await weatherForCoach(sql, DAN, NOW);
  assert.equal(calls(), 1, "forecast cache skips a second fetch in the same hour");
  assert.equal(again.length, 2);
}

{
  const calls = installMeteo(meteo(mildHours));
  setGeocodeTransport(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  const views = await weatherForCoach(sql, DAN, NOW);
  assert.equal(views.some((v) => v.lessonId === "wx-blank"), false);
  assert.equal(views.some((v) => v.lessonId === "wx-online"), false);
  const loc = (await sql.query<{ lat: number | null }>(`select lat from locations where id = 'loc-wx-blank'`))[0];
  assert.equal(loc?.lat, null);
  assert.equal(calls() >= 1, true);
}

{
  resetWeatherForTests();
  setWeatherTransport(async () => new Response(JSON.stringify(meteo(stormAtSoon)), { status: 200 }));
  const geoUrls: string[] = [];
  setGeocodeTransport(async (url) => {
    geoUrls.push(url);
    if (url.includes("place/details")) {
      return new Response(JSON.stringify({ status: "OK", result: { geometry: { location: { lat: 43.7, lng: -79.4 } } } }), {
        status: 200,
      });
    }
    return new Response("[]", { status: 200 });
  });
  const prev = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  await lesson("wx-place", new Date(NOW.getTime() + 10 * HOUR), "loc-wx-place");
  const views = await weatherForCoach(sql, DAN, NOW);
  delete process.env.GOOGLE_MAPS_API_KEY;
  if (prev) process.env.GOOGLE_MAPS_API_KEY = prev;
  assert.equal(views.some((v) => v.lessonId === "wx-place"), true);
  const saved = (await sql.query<{ lat: number; lng: number }>(`select lat, lng from locations where id = 'loc-wx-place'`))[0];
  assert.equal(saved?.lat, 43.7);
  assert.equal(saved?.lng, -79.4);
  assert.equal(geoUrls.some((url) => url.includes("place/details")), true);
}

{
  const mails: Array<{ to: string; subject: string; text: string }> = [];
  const pushes: string[] = [];
  installMeteo(meteo(stormAtSoon));
  const opened = await openAskAsStudent(sql, "emma-wx@x.test", "wx-soon", {
    now: NOW,
    sendMail: async (mail) => {
      mails.push(mail);
      return { ok: true };
    },
    pushCoach: async () => {
      pushes.push("coach");
      return { sent: 0, skipped: 1 };
    },
  });
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(opened.alreadyOpen, false);
  assert.equal(mails.length, 1);
  assert.match(mails[0]!.text, /Forecast may affect an outdoor lesson/);
  assert.equal(mails[0]!.to, "daniel@bookme.test");
  assert.equal(pushes.length, 1);
  const again = await openAskAsStudent(sql, "emma-wx@x.test", "wx-soon", {
    now: NOW,
    sendMail: async (mail) => {
      mails.push(mail);
      return { ok: true };
    },
  });
  assert.equal(again.ok && again.alreadyOpen, true);
  assert.equal(mails.length, 1, "an open ask is not emailed twice");
  const rows = await sql.query<{ status: string }>(`select status from weather_asks where lesson_id = 'wx-soon'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "open");
  const lessonRow = (await sql.query<{ status: string }>(`select status from lessons where id = 'wx-soon'`))[0];
  assert.equal(lessonRow?.status, "confirmed");
  const student = await weatherForStudent(sql, "emma-wx@x.test", NOW);
  assert.equal(student.find((v) => v.lessonId === "wx-soon")?.ask?.status, "open");
  assert.equal(student.find((v) => v.lessonId === "wx-soon")?.ask?.openedBy, "student");
}

{
  installMeteo(meteo(mildHours));
  const denied = await openAskAsStudent(sql, "emma-wx@x.test", "wx-later", {
    now: NOW,
    sendMail: async () => ({ ok: true }),
  });
  assert.equal(denied.ok, false);
  const stranger = await openAskAsStudent(sql, "other@x.test", "wx-soon", { now: NOW });
  assert.equal(stranger.ok, false);
}

{
  installMeteo(meteo(stormAtSoon));
  const kept = await resolveAskAsCoach(sql, coach, "wx-soon", "keep", { now: NOW });
  assert.equal(kept.ok, true);
  const ask = (await sql.query<{ status: string }>(`select status from weather_asks where lesson_id = 'wx-soon'`))[0];
  assert.equal(ask?.status, "keep");
  const lessonRow = (await sql.query<{ status: string }>(`select status from lessons where id = 'wx-soon'`))[0];
  assert.equal(lessonRow?.status, "confirmed");
  const pay = (await sql.query<{ status: string }>(`select status from payments where lesson_id = 'wx-soon'`))[0];
  assert.equal(pay?.status, "paid");
  const view = (await weatherForCoach(sql, DAN, NOW)).find((v) => v.lessonId === "wx-soon");
  assert.equal(view?.ask?.status, "keep");
}

{
  await lesson("wx-cancel", new Date(NOW.getTime() + 12 * HOUR));
  await sql.query(
    `insert into payments (id, lesson_id, method, status, amount_cad) values ('pay-wx-cancel', 'wx-cancel', 'card', 'paid', 85)`,
  );
  installMeteo(meteo(rainSpan));
  let cancels = 0;
  const failed = await resolveAskAsCoach(sql, coach, "wx-cancel", "cancel", {
    now: NOW,
    cancelLesson: async () => ({ ok: false, error: "stripe down" }),
  });
  assert.equal(failed.ok, false);
  const leftover = await sql.query(`select id from weather_asks where lesson_id = 'wx-cancel'`);
  assert.equal(leftover.length, 0, "a failed cancel does not leave an ask behind");
  const cancelled = await resolveAskAsCoach(sql, coach, "wx-cancel", "cancel", {
    now: NOW,
    cancelLesson: async (db, who, id) => {
      cancels += 1;
      await db.query(`update lessons set status = 'cancelled' where id = $1 and coach_id = $2`, [id, who.id]);
      return { ok: true, message: "Cancelled the lesson with Emma Chen. They were emailed." };
    },
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancels, 1);
  const status = (await sql.query<{ status: string }>(`select status from lessons where id = 'wx-cancel'`))[0];
  assert.equal(status?.status, "cancelled");
  const ask = (await sql.query<{ status: string }>(`select status from weather_asks where lesson_id = 'wx-cancel'`))[0];
  assert.equal(ask?.status, "cancelled");
  const pay = (await sql.query<{ status: string }>(`select status from payments where lesson_id = 'wx-cancel'`))[0];
  assert.equal(pay?.status, "paid", "weather cancel does not refund on its own; the injected coach cancel does");
}

{
  await lesson("wx-mail", new Date(NOW.getTime() + 14 * HOUR));
  installMeteo(meteo(rainSpan));
  const mailed = await openAskAsStudent(sql, "emma-wx@x.test", "wx-mail", {
    now: NOW,
    sendMail: async () => ({ ok: false, error: "resend down" }),
  });
  assert.equal(mailed.ok, false);
  const rows = await sql.query(`select id from weather_asks where lesson_id = 'wx-mail'`);
  assert.equal(rows.length, 0);
}

{
  installMeteo(meteo(mildHours));
  const nothing = await resolveAskAsCoach(sql, coach, "wx-later", "keep", { now: NOW });
  assert.equal(nothing.ok, false);
}

{
  resetWeatherForTests();
  setWeatherTransport(async () => new Response(JSON.stringify(meteo([{ at: 24, temp: 19, pop: 40 }])), { status: 200 }));
  const venue = await weatherForVenue(sql, {
    slug: "daniel-kim",
    locationId: "loc-wx",
    start: START.toISOString(),
    durationMin: 60,
    now: NOW,
  });
  assert.equal(venue?.summary, "19° · 40%");
  assert.equal(venue?.ask, null);
  const online = await weatherForVenue(sql, {
    slug: "daniel-kim",
    locationId: "loc-daniel-online",
    start: START.toISOString(),
    now: NOW,
  });
  assert.equal(online, null);
  const snippet = await weatherSnippetForLesson(sql, "wx-online", NOW);
  assert.equal(snippet, null);
}

{
  const second = await sql.query(
    `insert into weather_asks (id, lesson_id, coach_id, opened_by, signals, status)
     values ('ask-a', 'wx-later', $1, 'student', '[]'::jsonb, 'open')`,
    [DAN],
  );
  assert.equal(second.length, 0);
  await assert.rejects(
    sql.query(
      `insert into weather_asks (id, lesson_id, coach_id, opened_by, signals, status)
       values ('ask-b', 'wx-later', $1, 'coach', '[]'::jsonb, 'open')`,
      [DAN],
    ),
  );
  const open = await sql.query(`select id from weather_asks where lesson_id = 'wx-later' and status = 'open'`);
  assert.equal(open.length, 1);
}

{
  resetWeatherForTests();
  const fixtureDir = mkdtempSync(join(tmpdir(), "bookme-meteo-"));
  const fixture = join(fixtureDir, "open-meteo.json");
  writeFileSync(fixture, JSON.stringify(meteo([{ at: 24, temp: 11, pop: 15 }])));
  process.env.BOOKME_OPEN_METEO_FIXTURE = fixture;
  const fromFile = await weatherForVenue(sql, {
    slug: "daniel-kim",
    locationId: "loc-wx",
    start: START.toISOString(),
    now: NOW,
  });
  delete process.env.BOOKME_OPEN_METEO_FIXTURE;
  assert.equal(fromFile?.summary, "11° · 15%");
}

{
  assert.deepEqual(resolveOpenMeteoFixture("extreme"), { kind: "extreme" });
  assert.deepEqual(resolveOpenMeteoFixture("  extreme  "), { kind: "extreme" });
  const resolvedRel = resolveOpenMeteoFixture("fixtures/open-meteo-extreme.json", "/srv/bookme");
  const resolvedAbs = resolveOpenMeteoFixture("/tmp/open-meteo.json");
  assert.equal(resolvedRel.kind, "file");
  assert.equal(resolvedAbs.kind, "file");
  if (resolvedRel.kind === "file") assert.equal(resolvedRel.path, "/srv/bookme/fixtures/open-meteo-extreme.json");
  if (resolvedAbs.kind === "file") assert.equal(resolvedAbs.path, "/tmp/open-meteo.json");

  const shipped = JSON.parse(readFileSync(new URL("../../../fixtures/open-meteo-extreme.json", import.meta.url), "utf8")) as {
    hourly: {
      time: number[];
      precipitation_probability: number[];
      precipitation: number[];
      wind_gusts_10m: number[];
      weather_code: number[];
    };
  };
  assert.ok(shipped.hourly.time.length >= 80);
  assert.ok(Math.max(...shipped.hourly.precipitation_probability) >= 70);
  assert.ok(Math.max(...shipped.hourly.precipitation) >= 5);
  assert.ok(Math.max(...shipped.hourly.wind_gusts_10m) >= 60);
  assert.ok(shipped.hourly.weather_code.some((code) => code >= 95 && code <= 99));
  const aligned = alignExtremeFixture(shipped, NOW);
  const startSec = Math.floor(NOW.getTime() / 3_600_000) * 3600 - 3600;
  assert.equal(aligned.hourly?.time?.[0], startSec);

  resetWeatherForTests();
  const previous = process.env.BOOKME_OPEN_METEO_FIXTURE;
  process.env.BOOKME_OPEN_METEO_FIXTURE = "extreme";
  const storm = await weatherForVenue(sql, {
    slug: "daniel-kim",
    locationId: "loc-wx",
    start: START.toISOString(),
    durationMin: 60,
    now: NOW,
  });
  if (previous === undefined) delete process.env.BOOKME_OPEN_METEO_FIXTURE;
  else process.env.BOOKME_OPEN_METEO_FIXTURE = previous;
  assert.equal(storm?.extreme, true);
  assert.equal(storm?.summary, "18° · 90%");
  assert.equal(storm?.icon, "thunder");
  assert.ok(storm?.signals.some((signal) => signal.code === "precip"));
  assert.ok(storm?.signals.some((signal) => signal.code === "wind"));
  assert.ok(storm?.signals.some((signal) => signal.code === "thunder"));
}

{
  const api = readFileSync(new URL("./weather-api.ts", import.meta.url), "utf8");
  assert.match(api, /applyCancelLesson/);
  assert.doesNotMatch(api, /refunds\.create/);
  const cancel = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
  assert.match(cancel, /export async function applyCancelLesson/);
  assert.match(cancel, /closeOpenWeatherAsk/);
}

resetWeatherForTests();
await pg.close();
console.log("weather service tests ok");
