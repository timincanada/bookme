/**
 * Open-Meteo forecasts for in-person venues, plus weather_ask open / keep / cancel.
 *
 * Riley can mock the forecast without a network:
 *   BOOKME_OPEN_METEO_FIXTURE=extreme
 *     Shipped fixtures/open-meteo-extreme.json (rain, gusts, and thunder above
 *     the v1 thresholds). hourly.time is rewritten onto the lookup hour so a
 *     lesson inside 72h matches. This is the Preview setting — no filesystem path.
 *   BOOKME_OPEN_METEO_FIXTURE=/absolute/or/cwd-relative/open-meteo.json
 *     Raw Open-Meteo JSON, used as-is. hourly.time may be unix seconds or ISO.
 *   BOOKME_OPEN_METEO_BASE=https://example.test/v1/forecast
 *     Replaces https://api.open-meteo.com/v1/forecast. The query string is unchanged.
 * Cache is in-process, keyed by rounded lat/lng and UTC hour, for 45 minutes.
 */
import { isAbsolute, resolve } from "node:path";
import extremeFixtureJson from "../../../fixtures/open-meteo-extreme.json";
import { publicAppUrl } from "./app-url";
import { sendMail, type Mail } from "./mail";
import { googleMapsApiKey, isPlacesConfigured } from "./places";
import { pushToCoach } from "./push";
import { formatWhen } from "./time";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./timezone";
import {
  FORECAST_CACHE_MS,
  forecastCacheKey,
  hoursOverlapping,
  isOnlineKind,
  isUpcomingWithinWindow,
  parseOpenMeteo,
  readForecast,
  validCoords,
  weatherAskMail,
  type ForecastRead,
  type HourPoint,
  type WeatherIconName,
  type WeatherSignal,
} from "./weather";

type QuerySql = { query: <T>(text: string, params?: unknown[]) => Promise<T[]> };

export type LessonWeatherView = {
  lessonId: string;
  place: string;
  when: string;
  summary: string;
  icon: WeatherIconName;
  extreme: boolean;
  headline: string | null;
  signal: string | null;
  signals: WeatherSignal[];
  ask: { id: string; status: "open" | "keep" | "cancelled"; openedBy: "coach" | "student" } | null;
};

export type WeatherSnippet = {
  summary: string;
  extreme: boolean;
  icon: WeatherIconName;
  signal: string | null;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type CacheEntry = { exp: number; points: HourPoint[] | null };

const g = globalThis as typeof globalThis & {
  __bookmeForecastCache?: Map<string, CacheEntry>;
  __bookmeGeoFail?: Map<string, number>;
};

function forecastCache() {
  g.__bookmeForecastCache ??= new Map();
  return g.__bookmeForecastCache;
}

function geoFailCache() {
  g.__bookmeGeoFail ??= new Map();
  return g.__bookmeGeoFail;
}

let weatherTransport: FetchLike | null = null;
let geocodeTransport: FetchLike | null = null;
let lastNominatim = 0;

const OPEN_METEO_DEFAULT = "https://api.open-meteo.com/v1/forecast";
const NOMINATIM_DEFAULT = "https://nominatim.openstreetmap.org/search";
const GEO_FAIL_MS = FORECAST_CACHE_MS;
const FETCH_MS = 8000;

export function setWeatherTransport(fn: FetchLike | null) {
  weatherTransport = fn;
}

export function setGeocodeTransport(fn: FetchLike | null) {
  geocodeTransport = fn;
}

export function resetWeatherForTests() {
  weatherTransport = null;
  geocodeTransport = null;
  lastNominatim = 0;
  forecastCache().clear();
  geoFailCache().clear();
}

function tzOf(value: string | null | undefined) {
  return value && isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isUnique(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

type ExtremeFixture = {
  hourly?: {
    time?: unknown[];
    [key: string]: unknown;
  };
};

const extremeFixture = extremeFixtureJson as ExtremeFixture;

async function readFixture(path: string) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

/** `extreme` is the shipped storm. Anything else is a file path, absolute or from cwd. */
export function resolveOpenMeteoFixture(spec: string, cwd = process.cwd()) {
  const trimmed = spec.trim();
  if (trimmed === "extreme") return { kind: "extreme" as const };
  const path = isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
  return { kind: "file" as const, path };
}

/** Shift shipped hourly.time so hour 0 is the previous UTC hour. Values stay extreme. */
export function alignExtremeFixture(body: ExtremeFixture, now: Date): ExtremeFixture {
  const time = body.hourly?.time;
  if (!Array.isArray(time) || time.length === 0) return body;
  const startSec = Math.floor(now.getTime() / 3_600_000) * 3600 - 3600;
  return {
    ...body,
    hourly: {
      ...body.hourly,
      time: time.map((_, i) => startSec + i * 3600),
    },
  };
}

async function fixtureBody(spec: string, now: Date) {
  const resolved = resolveOpenMeteoFixture(spec);
  if (resolved.kind === "extreme") return alignExtremeFixture(extremeFixture, now);
  return JSON.parse(await readFixture(resolved.path)) as unknown;
}

async function fetchOpenMeteo(lat: number, lng: number, now: Date): Promise<HourPoint[]> {
  const fixture = process.env.BOOKME_OPEN_METEO_FIXTURE?.trim();
  if (!weatherTransport && fixture) {
    return parseOpenMeteo(await fixtureBody(fixture, now));
  }
  const base = (process.env.BOOKME_OPEN_METEO_BASE || OPEN_METEO_DEFAULT).trim();
  const url = new URL(base);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "hourly",
    "temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code",
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  const fetcher = weatherTransport ?? fetch;
  const res = await fetcher(url.toString(), { signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return parseOpenMeteo(await res.json());
}

async function cachedForecast(lat: number, lng: number, now: Date): Promise<HourPoint[] | null> {
  const key = forecastCacheKey(lat, lng, now);
  const hit = forecastCache().get(key);
  if (hit && hit.exp > Date.now()) return hit.points;
  try {
    const points = await fetchOpenMeteo(lat, lng, now);
    forecastCache().set(key, { exp: Date.now() + FORECAST_CACHE_MS, points });
    return points;
  } catch (err) {
    console.error(JSON.stringify({ msg: "weather_fetch_failed", error: String(err) }));
    forecastCache().set(key, { exp: Date.now() + 5 * 60 * 1000, points: null });
    return null;
  }
}

async function geoFetch(url: string, init?: RequestInit) {
  const fetcher = geocodeTransport ?? fetch;
  return fetcher(url, { ...init, signal: AbortSignal.timeout(FETCH_MS) });
}

async function geocodeVenue(placeId: string | null, address: string): Promise<{ lat: number; lng: number } | null> {
  const id = placeId?.trim() || "";
  const line = address.trim();
  if (id && isPlacesConfigured()) {
    const key = googleMapsApiKey();
    if (key) {
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        url.searchParams.set("place_id", id);
        url.searchParams.set("fields", "geometry");
        url.searchParams.set("key", key);
        const res = await geoFetch(url.toString());
        const body = (await res.json()) as {
          status?: string;
          result?: { geometry?: { location?: { lat?: number; lng?: number } } };
        };
        const coords = validCoords(body.result?.geometry?.location?.lat, body.result?.geometry?.location?.lng);
        if (body.status === "OK" && coords) return coords;
      } catch (err) {
        console.error(JSON.stringify({ msg: "weather_places_failed", error: String(err) }));
      }
    }
  }
  if (!line) return null;
  try {
    if (!geocodeTransport) {
      const wait = 1100 - (Date.now() - lastNominatim);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastNominatim = Date.now();
    const base = (process.env.BOOKME_NOMINATIM_BASE || NOMINATIM_DEFAULT).trim();
    const url = new URL(base);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", line);
    const res = await geoFetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "BookMe/1.0 (bookme.training)",
      },
    });
    const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = Array.isArray(body) ? body[0] : null;
    return validCoords(hit?.lat, hit?.lon);
  } catch (err) {
    console.error(JSON.stringify({ msg: "weather_nominatim_failed", error: String(err) }));
    return null;
  }
}

async function ensureCoords(
  sql: QuerySql,
  loc: { id: string; lat: unknown; lng: unknown; address: string | null; place_id: string | null },
): Promise<{ lat: number; lng: number } | null> {
  const have = validCoords(loc.lat, loc.lng);
  if (have) return have;
  const failed = geoFailCache().get(loc.id);
  if (failed && failed > Date.now()) return null;
  const coords = await geocodeVenue(loc.place_id, loc.address || "");
  if (!coords) {
    geoFailCache().set(loc.id, Date.now() + GEO_FAIL_MS);
    return null;
  }
  await sql.query(
    `update locations set lat = $1, lng = $2 where id = $3 and (lat is null or lng is null)`,
    [coords.lat, coords.lng, loc.id],
  );
  loc.lat = coords.lat;
  loc.lng = coords.lng;
  return coords;
}

type LessonRow = {
  id: string;
  start_at: string | Date;
  end_at: string | Date;
  status: string;
  coach_id: string;
  coach_name: string;
  coach_email: string;
  timezone: string;
  client_name: string;
  client_email: string;
  location_id: string;
  location_name: string;
  location_kind: string;
  address: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
};

const LESSON_WX = `l.id, l.start_at, l.end_at, l.status, l.coach_id,
  c.name as coach_name, c.email as coach_email, c.timezone,
  cl.name as client_name, cl.email as client_email,
  loc.id as location_id, loc.name as location_name, loc.kind as location_kind,
  loc.address, loc.place_id, loc.lat, loc.lng`;

type AskRow = {
  id: string;
  lesson_id: string;
  opened_by: string;
  status: string;
  signals: unknown;
  created_at: string | Date;
};

async function latestAsks(sql: QuerySql, lessonIds: string[]) {
  const map = new Map<string, AskRow>();
  if (!lessonIds.length) return map;
  const placeholders = lessonIds.map((_, i) => `$${i + 1}`).join(",");
  const rows = await sql.query<AskRow>(
    `select id, lesson_id, opened_by, status, signals, created_at
     from weather_asks where lesson_id in (${placeholders})
     order by created_at desc`,
    lessonIds,
  );
  for (const row of rows) {
    if (!map.has(row.lesson_id)) map.set(row.lesson_id, row);
  }
  return map;
}

function askView(row: AskRow | undefined): LessonWeatherView["ask"] {
  if (!row) return null;
  if (row.status !== "open" && row.status !== "keep" && row.status !== "cancelled") return null;
  if (row.opened_by !== "coach" && row.opened_by !== "student") return null;
  if (row.status === "cancelled") return null;
  return { id: row.id, status: row.status, openedBy: row.opened_by };
}

async function forecastAt(
  sql: QuerySql,
  loc: { id?: string; location_id?: string; lat: unknown; lng: unknown; address: string | null; place_id: string | null },
  start: Date,
  end: Date,
  now: Date,
): Promise<ForecastRead | null> {
  const id = loc.location_id || loc.id;
  if (!id) return null;
  const coords = await ensureCoords(sql, {
    id,
    lat: loc.lat,
    lng: loc.lng,
    address: loc.address,
    place_id: loc.place_id,
  });
  if (!coords) return null;
  const points = await cachedForecast(coords.lat, coords.lng, now);
  if (!points) return null;
  return readForecast(hoursOverlapping(points, start, end));
}

async function viewsFor(sql: QuerySql, rows: LessonRow[], now: Date): Promise<LessonWeatherView[]> {
  const eligible = rows.filter((row) => {
    if (row.status !== "confirmed") return false;
    if (isOnlineKind(row.location_kind)) return false;
    const start = asDate(row.start_at);
    return !!start && isUpcomingWithinWindow(start, now);
  });
  const asks = await latestAsks(
    sql,
    eligible.map((row) => row.id),
  );
  const byLoc = new Map<string, LessonRow[]>();
  for (const row of eligible) {
    const list = byLoc.get(row.location_id) || [];
    list.push(row);
    byLoc.set(row.location_id, list);
  }
  const hoursByLoc = new Map<string, HourPoint[] | null>();
  await Promise.all(
    [...byLoc.entries()].map(async ([locationId, list]) => {
      const sample = list[0]!;
      try {
        const coords = await ensureCoords(sql, {
          id: sample.location_id,
          lat: sample.lat,
          lng: sample.lng,
          address: sample.address,
          place_id: sample.place_id,
        });
        if (!coords) {
          hoursByLoc.set(locationId, null);
          return;
        }
        hoursByLoc.set(locationId, await cachedForecast(coords.lat, coords.lng, now));
      } catch (err) {
        console.error(JSON.stringify({ msg: "weather_location_failed", locationId, error: String(err) }));
        hoursByLoc.set(locationId, null);
      }
    }),
  );
  const views: LessonWeatherView[] = [];
  for (const row of eligible) {
    const hours = hoursByLoc.get(row.location_id);
    if (!hours) continue;
    const start = asDate(row.start_at)!;
    const end = asDate(row.end_at) ?? new Date(start.getTime() + 60 * 60 * 1000);
    const read = readForecast(hoursOverlapping(hours, start, end));
    if (!read) continue;
    const tz = tzOf(row.timezone);
    views.push({
      lessonId: row.id,
      place: row.location_name,
      when: formatWhen(start, tz),
      summary: read.summary,
      icon: read.icon,
      extreme: read.extreme,
      headline: read.headline,
      signal: read.signal,
      signals: read.signals,
      ask: askView(asks.get(row.id)),
    });
  }
  return views;
}

const WINDOW_SQL = `l.status = 'confirmed'
  and l.start_at >= $2
  and l.start_at <= $3
  and lower(loc.kind) <> 'online'`;

export async function weatherForCoach(sql: QuerySql, coachId: string, now = new Date()) {
  const until = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const rows = await sql.query<LessonRow>(
    `select ${LESSON_WX}
     from lessons l
     join coaches c on c.id = l.coach_id
     join clients cl on cl.id = l.client_id
     join locations loc on loc.id = l.location_id
     where l.coach_id = $1 and ${WINDOW_SQL}`,
    [coachId, now.toISOString(), until.toISOString()],
  );
  return viewsFor(sql, rows, now);
}

export async function weatherForStudent(sql: QuerySql, email: string, now = new Date()) {
  const until = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const rows = await sql.query<LessonRow>(
    `select ${LESSON_WX}
     from lessons l
     join coaches c on c.id = l.coach_id
     join clients cl on cl.id = l.client_id
     join locations loc on loc.id = l.location_id
     where lower(cl.email) = $1 and ${WINDOW_SQL}`,
    [email, now.toISOString(), until.toISOString()],
  );
  return viewsFor(sql, rows, now);
}

export async function weatherForVenue(
  sql: QuerySql,
  input: { slug: string; locationId?: string | null; start: string; durationMin?: number; now?: Date },
): Promise<LessonWeatherView | null> {
  const now = input.now ?? new Date();
  const start = asDate(input.start);
  if (!start || start.getTime() < now.getTime()) return null;
  const duration = Math.min(240, Math.max(15, Number(input.durationMin) || 60));
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const rows = await sql.query<LessonRow>(
    `select loc.id as location_id, loc.name as location_name, loc.kind as location_kind,
            loc.address, loc.place_id, loc.lat, loc.lng, c.timezone,
            c.name as coach_name, c.email as coach_email, c.id as coach_id
     from coaches c
     join locations loc on loc.coach_id = c.id and loc.active = true
     where c.slug = $1 and c.deleted_at is null
       and ($2::text is null or loc.id = $2)
     order by case when lower(loc.kind) = 'online' then 1 else 0 end, loc.name
     limit 1`,
    [input.slug, input.locationId || null],
  );
  const loc = rows[0];
  if (!loc || isOnlineKind(loc.location_kind)) return null;
  const read = await forecastAt(
    sql,
    {
      id: loc.location_id,
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address,
      place_id: loc.place_id,
    },
    start,
    end,
    now,
  );
  if (!read) return null;
  return {
    lessonId: "",
    place: loc.location_name,
    when: formatWhen(start, tzOf(loc.timezone)),
    summary: read.summary,
    icon: read.icon,
    extreme: read.extreme,
    headline: read.headline,
    signal: read.signal,
    signals: read.signals,
    ask: null,
  };
}

export async function weatherSnippetForLesson(sql: QuerySql, lessonId: string, now = new Date()): Promise<WeatherSnippet | null> {
  try {
    const rows = await sql.query<LessonRow>(
      `select ${LESSON_WX}
       from lessons l
       join coaches c on c.id = l.coach_id
       join clients cl on cl.id = l.client_id
       join locations loc on loc.id = l.location_id
       where l.id = $1`,
      [lessonId],
    );
    const row = rows[0];
    const start = row ? asDate(row.start_at) : null;
    if (!row || !start || row.status !== "confirmed" || isOnlineKind(row.location_kind)) return null;
    if (!isUpcomingWithinWindow(start, now)) return null;
    const end = asDate(row.end_at) ?? new Date(start.getTime() + 60 * 60 * 1000);
    const read = await forecastAt(sql, row, start, end, now);
    if (!read) return null;
    return { summary: read.summary, extreme: read.extreme, icon: read.icon, signal: read.signal };
  } catch (err) {
    console.error(JSON.stringify({ msg: "weather_snippet_failed", error: String(err) }));
    return null;
  }
}

type CoachRef = { id: string; name: string; email: string; timezone: string | null };

type CancelFn = (
  sql: QuerySql,
  coach: CoachRef,
  lessonId: string,
) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>;

async function loadOwned(
  sql: QuerySql,
  lessonId: string,
  owner: { coachId?: string; email?: string },
) {
  const rows = await sql.query<LessonRow>(
    `select ${LESSON_WX}
     from lessons l
     join coaches c on c.id = l.coach_id
     join clients cl on cl.id = l.client_id
     join locations loc on loc.id = l.location_id
     where l.id = $1
       and ($2::text is null or l.coach_id = $2)
       and ($3::text is null or lower(cl.email) = $3)`,
    [lessonId, owner.coachId ?? null, owner.email ?? null],
  );
  return rows[0] ?? null;
}

async function openAskRow(sql: QuerySql, lessonId: string) {
  const rows = await sql.query<AskRow>(
    `select id, lesson_id, opened_by, status, signals, created_at
     from weather_asks where lesson_id = $1 and status = 'open' limit 1`,
    [lessonId],
  );
  return rows[0] ?? null;
}

export async function openAskAsStudent(
  sql: QuerySql,
  email: string,
  lessonId: string,
  deps: { now?: Date; sendMail?: (mail: Mail) => Promise<{ ok: boolean; error?: string }>; pushCoach?: typeof pushToCoach } = {},
) {
  const now = deps.now ?? new Date();
  const deliver = deps.sendMail ?? ((mail: Mail) => sendMail(mail, { template: "weather_ask" }));
  const push = deps.pushCoach ?? pushToCoach;
  const row = await loadOwned(sql, lessonId, { email });
  if (!row) return { ok: false as const, error: "Lesson not found" };
  const existing = await openAskRow(sql, lessonId);
  if (existing) return { ok: true as const, alreadyOpen: true };
  if (row.status !== "confirmed" || isOnlineKind(row.location_kind)) {
    return { ok: false as const, error: "Weather isn't available for this lesson" };
  }
  const start = asDate(row.start_at);
  if (!start || !isUpcomingWithinWindow(start, now)) {
    return { ok: false as const, error: "Weather isn't available for this lesson" };
  }
  const end = asDate(row.end_at) ?? new Date(start.getTime() + 60 * 60 * 1000);
  const read = await forecastAt(sql, row, start, end, now);
  if (!read?.extreme) return { ok: false as const, error: "This forecast isn't in the extreme range" };
  const id = crypto.randomUUID();
  try {
    await sql.query(
      `insert into weather_asks (id, lesson_id, coach_id, opened_by, signals, status)
       values ($1, $2, $3, 'student', $4::jsonb, 'open')`,
      [id, row.id, row.coach_id, JSON.stringify(read.signals)],
    );
  } catch (err) {
    if (isUnique(err)) return { ok: true as const, alreadyOpen: true };
    throw err;
  }
  const tz = tzOf(row.timezone);
  const mail = weatherAskMail({
    coachEmail: row.coach_email,
    studentName: row.client_name,
    when: formatWhen(start, tz),
    place: row.location_name,
    signal: read.signal || "the forecast",
    lessonUrl: `${publicAppUrl()}/app/lessons/${row.id}`,
  });
  const sent = await deliver(mail);
  if (!sent.ok) {
    await sql.query(`delete from weather_asks where id = $1 and status = 'open'`, [id]);
    return { ok: false as const, error: "Couldn't email your coach. Try again." };
  }
  try {
    await push(sql, row.coach_id, {
      title: "Weather check",
      body: `${row.client_name} asked you to keep or cancel ${formatWhen(start, tz)}`,
      path: `/app/lessons/${row.id}`,
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: "weather_push_failed", error: String(err) }));
  }
  return { ok: true as const, alreadyOpen: false };
}

export async function resolveAskAsCoach(
  sql: QuerySql,
  coach: CoachRef,
  lessonId: string,
  decision: "keep" | "cancel",
  deps: { now?: Date; cancelLesson?: CancelFn } = {},
) {
  if (decision !== "keep" && decision !== "cancel") return { ok: false as const, error: "Choose keep or cancel" };
  const now = deps.now ?? new Date();
  const row = await loadOwned(sql, lessonId, { coachId: coach.id });
  if (!row || row.status !== "confirmed") return { ok: false as const, error: "Lesson not found" };
  const open = await openAskRow(sql, lessonId);
  const start = asDate(row.start_at);
  const inWindow = !!start && !isOnlineKind(row.location_kind) && isUpcomingWithinWindow(start, now);
  let read: ForecastRead | null = null;
  if (inWindow && start) {
    const end = asDate(row.end_at) ?? new Date(start.getTime() + 60 * 60 * 1000);
    read = await forecastAt(sql, row, start, end, now);
  }
  if (!open && !read?.extreme) return { ok: false as const, error: "Nothing to decide for this lesson" };

  if (decision === "keep") {
    if (open) {
      await sql.query(
        `update weather_asks set status = 'keep', resolved_at = $2 where id = $1 and status = 'open'`,
        [open.id, now.toISOString()],
      );
    } else {
      await sql.query(
        `insert into weather_asks (id, lesson_id, coach_id, opened_by, signals, status, resolved_at)
         values ($1, $2, $3, 'coach', $4::jsonb, 'keep', $5)`,
        [crypto.randomUUID(), row.id, coach.id, JSON.stringify(read?.signals ?? []), now.toISOString()],
      );
    }
    return { ok: true as const, decision: "keep" as const };
  }

  if (!deps.cancelLesson) return { ok: false as const, error: "Cancel is unavailable" };
  let createdId: string | null = null;
  if (!open) {
    createdId = crypto.randomUUID();
    try {
      await sql.query(
        `insert into weather_asks (id, lesson_id, coach_id, opened_by, signals, status)
         values ($1, $2, $3, 'coach', $4::jsonb, 'open')`,
        [createdId, row.id, coach.id, JSON.stringify(read?.signals ?? [])],
      );
    } catch (err) {
      if (!isUnique(err)) throw err;
      createdId = null;
    }
  }
  const cancelled = await deps.cancelLesson(sql, coach, row.id);
  if (!cancelled.ok) {
    if (createdId) await sql.query(`delete from weather_asks where id = $1 and status = 'open'`, [createdId]);
    return cancelled;
  }
  await closeOpenWeatherAsk(sql, row.id, now);
  return { ok: true as const, decision: "cancel" as const, message: cancelled.message };
}

/** Mark an open ask cancelled. Used after the existing coach-cancel path succeeds. */
export async function closeOpenWeatherAsk(sql: QuerySql, lessonId: string, now = new Date()) {
  await sql.query(
    `update weather_asks set status = 'cancelled', resolved_at = $2 where lesson_id = $1 and status = 'open'`,
    [lessonId, now.toISOString()],
  );
}
