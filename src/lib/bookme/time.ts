/**
 * Calendar + clock helpers.
 *
 * Instants are stored as absolute UTC times. Every conversion between an
 * instant and a civil date / wall-clock time takes the coach's (studio's) IANA
 * time zone explicitly — there is no implicit default zone.
 *
 * Date keys are civil dates "YYYY-MM-DD". Pure date-key arithmetic below never
 * depends on a zone.
 */

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Pure date-key arithmetic (zone-independent)
// ---------------------------------------------------------------------------

function keyToUtcNoon(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function utcToKey(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return utcToKey(keyToUtcNoon(value)) === value;
}

/** 0 = Sunday … 6 = Saturday, for the civil date itself. */
export function weekdayOf(dateKey: string) {
  return keyToUtcNoon(dateKey).getUTCDay();
}

export function addDaysKey(dateKey: string, days: number) {
  const d = keyToUtcNoon(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetweenKeys(a: string, b: string) {
  return Math.round((keyToUtcNoon(b).getTime() - keyToUtcNoon(a).getTime()) / 86_400_000);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Calendar-month addition, clamped to month end (3/31 + 6 → 9/30). */
export function addMonthsKey(dateKey: string, months: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

/** Monday of the Monday-based week containing dateKey. */
export function mondayOfKey(dateKey: string) {
  return addDaysKey(dateKey, -((weekdayOf(dateKey) + 6) % 7));
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const firstKey = `${year}-${pad(month)}-01`;
  const firstWeekday = weekdayOf(firstKey);
  const days = daysInMonth(year, month);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** Sunday-based week (calendar views). */
export function weekStartKey(dateKey: string) {
  return addDaysKey(dateKey, -weekdayOf(dateKey));
}

export function weekKeys(dateKey: string) {
  const start = weekStartKey(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
}

/** Format a civil date (no zone involved), e.g. "Tue, Sep 22". */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return keyToUtcNoon(dateKey).toLocaleDateString("en-CA", { ...options, timeZone: "UTC" });
}

export function formatWeekRange(keys: string[]) {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return "";
  const left = formatDateKey(first, { month: "short", day: "numeric" });
  if (first.slice(0, 7) === last.slice(0, 7)) return `${left} – ${Number(last.slice(8))}`;
  return `${left} – ${formatDateKey(last, { month: "short", day: "numeric" })}`;
}

/** Wall-clock label for minutes after midnight, e.g. 960 → "4:00 p.m.". */
export function formatClockMinutes(minutes: number) {
  const d = new Date(Date.UTC(2026, 0, 15, Math.floor(minutes / 60), minutes % 60));
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export function formatHourLabel(hour: number) {
  return formatClockMinutes(hour * 60).replace(":00", "");
}

// ---------------------------------------------------------------------------
// Zone-aware conversions
// ---------------------------------------------------------------------------

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

function wallParts(d: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { y: out.year, mo: out.month, d: out.day, h: out.hour % 24, mi: out.minute, s: out.second };
}

/** Offset of `tz` from UTC at instant `d`, in ms (EDT → -4h). */
function offsetMs(d: Date, tz: string) {
  const w = wallParts(d, tz);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Civil date of instant `d` in `tz`. */
export function dateKeyAt(d: Date, tz: string) {
  const w = wallParts(d, tz);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
}

export function todayKey(tz: string, now = new Date()) {
  return dateKeyAt(now, tz);
}

/** Minutes after local midnight of instant `d` in `tz`. */
export function minutesAt(d: Date, tz: string) {
  const w = wallParts(d, tz);
  return w.h * 60 + w.mi;
}

/**
 * The instant for wall-clock `minutes` on civil `dateKey` in `tz`, or null when
 * that wall time does not exist (spring-forward gap). When it exists twice
 * (fall-back), the earlier instant is returned.
 */
export function zonedInstantExact(dateKey: string, minutes: number, tz: string): Date | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const offsets = new Set([
    offsetMs(new Date(guess - 36 * 3600_000), tz),
    offsetMs(new Date(guess), tz),
    offsetMs(new Date(guess + 36 * 3600_000), tz),
  ]);
  const hits: number[] = [];
  for (const off of offsets) {
    const t = new Date(guess - off);
    if (dateKeyAt(t, tz) === dateKey && minutesAt(t, tz) === minutes) hits.push(t.getTime());
  }
  if (!hits.length) return null;
  return new Date(Math.min(...hits));
}

/** Like zonedInstantExact, but a gap time resolves to the instant just after the gap. */
export function zonedInstant(dateKey: string, minutes: number, tz: string): Date {
  const exact = zonedInstantExact(dateKey, minutes, tz);
  if (exact) return exact;
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  return new Date(guess - offsetMs(new Date(guess - 36 * 3600_000), tz));
}

export function formatWhen(d: Date, tz: string) {
  return d.toLocaleString("en-CA", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(d: Date, tz: string) {
  return d.toLocaleTimeString("en-CA", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function datesFromToday(count: number, tz: string): string[] {
  const today = todayKey(tz);
  return Array.from({ length: count }, (_, i) => addDaysKey(today, i));
}
