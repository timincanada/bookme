/**
 * Next booking + open swap/move for one coach↔client thread.
 * Both viewers see the same date, time, and place. Students never see the other student's name.
 */
import { normalizeEmail } from "./email";
import { ANOTHER_STUDENT } from "./requests";
import { formatTime, formatWhen } from "./time";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./timezone";

type QuerySql = { query: <T>(text: string, params?: unknown[]) => Promise<T[]> };

export type ThreadPendingCard = {
  id: string;
  kind: "coach_swap" | "student_move";
  lines: [string, string];
};

export type ThreadBookingCard = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  place: string;
};

export type ThreadCardModel = {
  pending: ThreadPendingCard | null;
  booking: ThreadBookingCard | null;
};

type Scope =
  | { viewer: "coach"; coachId: string; clientId: string }
  | { viewer: "student"; coachId: string; email: string };

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function tzOf(value: string | null | undefined) {
  return value && isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}

function dateLabel(d: Date, tz: string) {
  return d.toLocaleDateString("en-CA", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function placeOf(kind: string | null, name: string | null) {
  if ((kind || "").toLowerCase() === "online") return "Online";
  const trimmed = (name || "").trim();
  return trimmed || "Online";
}

type PendingRow = {
  id: string;
  kind: string;
  proposed_start: string | Date | null;
  primary_start: string | Date;
  primary_name: string;
  primary_email: string | null;
  other_start: string | Date | null;
  other_name: string | null;
  other_email: string | null;
  timezone: string;
};

type BookingRow = {
  id: string;
  start_at: string | Date;
  location_name: string | null;
  location_kind: string | null;
  timezone: string;
};

const UPCOMING = `l.status in ('confirmed', 'held') and l.start_at >= $2`;

function partyParam(scope: Scope) {
  return scope.viewer === "coach" ? scope.clientId : normalizeEmail(scope.email);
}

function pendingLines(row: PendingRow, scope: Scope, tz: string): [string, string] {
  const primaryWhen = formatWhen(asDate(row.primary_start)!, tz);
  if (row.kind === "student_move") {
    const next = asDate(row.proposed_start);
    const nextWhen = next ? formatWhen(next, tz) : "a new time";
    if (scope.viewer === "coach")
      return [`${row.primary_name} · ${primaryWhen}`, `Proposed · ${nextWhen}`];
    return [`Your lesson · ${primaryWhen}`, `Proposed · ${nextWhen}`];
  }
  const otherWhen = row.other_start ? formatWhen(asDate(row.other_start)!, tz) : "";
  if (scope.viewer === "coach") {
    return [
      `${row.primary_name} · ${primaryWhen}`,
      `${row.other_name || "Student"} · ${otherWhen}`,
    ];
  }
  const email = normalizeEmail(scope.email);
  const viewerIsOther =
    normalizeEmail(row.other_email || "") === email &&
    normalizeEmail(row.primary_email || "") !== email;
  const yourWhen = viewerIsOther ? otherWhen : primaryWhen;
  const theirWhen = viewerIsOther ? primaryWhen : otherWhen;
  return [`Your lesson · ${yourWhen}`, `${ANOTHER_STUDENT} · ${theirWhen}`];
}

async function loadPending(
  sql: QuerySql,
  scope: Scope,
  nowIso: string,
): Promise<ThreadPendingCard | null> {
  const party =
    scope.viewer === "coach"
      ? "(l.client_id = $3 or o.client_id = $3)"
      : "(lower(cl.email) = $3 or lower(ocl.email) = $3)";
  const rows = await sql.query<PendingRow>(
    `select r.id, r.kind, r.proposed_start,
            l.start_at as primary_start, cl.name as primary_name, cl.email as primary_email,
            o.start_at as other_start, ocl.name as other_name, ocl.email as other_email,
            c.timezone
     from booking_requests r
     join coaches c on c.id = r.coach_id
     join lessons l on l.id = r.lesson_id
     join clients cl on cl.id = l.client_id
     left join lessons o on o.id = r.other_lesson_id
     left join clients ocl on ocl.id = o.client_id
     where r.coach_id = $1
       and r.status = 'pending'
       and r.kind in ('coach_swap', 'student_move')
       and ${party}
       and (
         (r.kind = 'student_move' and ${UPCOMING})
         or (
           r.kind = 'coach_swap'
           and ${UPCOMING}
           and o.id is not null
           and o.status in ('confirmed', 'held')
           and o.start_at >= $2
         )
       )
     order by case when r.kind = 'coach_swap' then 0 else 1 end, r.created_at desc
     limit 1`,
    [scope.coachId, nowIso, partyParam(scope)],
  );
  const row = rows[0];
  if (!row || (row.kind !== "coach_swap" && row.kind !== "student_move")) return null;
  return { id: row.id, kind: row.kind, lines: pendingLines(row, scope, tzOf(row.timezone)) };
}

async function loadBooking(
  sql: QuerySql,
  scope: Scope,
  nowIso: string,
): Promise<ThreadBookingCard | null> {
  const party = scope.viewer === "coach" ? "l.client_id = $3" : "lower(cl.email) = $3";
  const rows = await sql.query<BookingRow>(
    `select l.id, l.start_at, loc.name as location_name, loc.kind as location_kind, c.timezone
     from lessons l
     join locations loc on loc.id = l.location_id
     join coaches c on c.id = l.coach_id
     join clients cl on cl.id = l.client_id
     where l.coach_id = $1
       and l.status in ('confirmed', 'held')
       and l.start_at >= $2
       and ${party}
     order by l.start_at asc
     limit 1`,
    [scope.coachId, nowIso, partyParam(scope)],
  );
  const row = rows[0];
  const start = row ? asDate(row.start_at) : null;
  if (!row || !start) return null;
  const tz = tzOf(row.timezone);
  return {
    id: row.id,
    dateLabel: dateLabel(start, tz),
    timeLabel: formatTime(start, tz),
    place: placeOf(row.location_kind, row.location_name),
  };
}

/** Upcoming lesson and the open swap (preferred) or move for this pair. Cancelled and past lessons are skipped. */
export async function loadThreadCards(
  sql: QuerySql,
  scope: Scope,
  now = new Date(),
): Promise<ThreadCardModel> {
  const nowIso = now.toISOString();
  const [pending, booking] = await Promise.all([
    loadPending(sql, scope, nowIso),
    loadBooking(sql, scope, nowIso),
  ]);
  return { pending, booking };
}
