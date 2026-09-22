import type { Sql } from "@/lib/db";
import { isHoldOpen } from "./hold";
import { addDaysKey, dateKeyAt, weekdayOf, zonedInstantExact } from "./time";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./timezone";

type QuerySql = Pick<Sql, "query">;

export function overlapsBlock(m: number, duration: number, startMin?: number | null, endMin?: number | null) {
  const blockStart = startMin ?? 0;
  const blockEnd = endMin ?? 1440;
  return m < blockEnd && m + duration > blockStart;
}

export async function expireHolds(sql: QuerySql, coachId?: string) {
  if (coachId) {
    await sql.query(
      `update lessons set status = 'expired' where status = 'held' and hold_until < now() and coach_id = $1`,
      [coachId],
    );
    return;
  }
  await sql.query(`update lessons set status = 'expired' where status = 'held' and hold_until < now()`);
}

/** The coach's (studio's) IANA time zone. */
export async function coachTimezone(sql: QuerySql, coachId: string) {
  const rows = await sql.query<{ timezone: string }>(`select timezone from coaches where id = $1`, [coachId]);
  const tz = rows[0]?.timezone;
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

type HourRow = { start_min: number; end_min: number };
type BlockRow = { start_min: number; end_min: number };
type TakenRow = { start_at: string | Date; end_at: string | Date; status: string; hold_until: string | Date | null };

/**
 * Public openings for a civil date in the coach's time zone. Starts step by an
 * hour inside weekly hours; blocked, taken (confirmed or open hold) and past
 * times are removed. Wall times that do not exist on that date (DST gap) are
 * skipped.
 */
export async function openSlots(sql: QuerySql, coachId: string, dateKey: string, durationMin: number) {
  await expireHolds(sql, coachId);
  const tz = await coachTimezone(sql, coachId);
  const weekday = weekdayOf(dateKey);
  const hours = await sql.query<HourRow>(
    `select start_min, end_min from weekly_hours where coach_id = $1 and weekday = $2`,
    [coachId, weekday],
  );
  const blocks = await sql.query<BlockRow>(
    `select start_min, end_min from date_blocks where coach_id = $1 and date = $2`,
    [coachId, dateKey],
  );
  if (hours.length === 0) return [] as string[];

  const dayStart = zonedInstantExact(dateKey, 0, tz) ?? new Date(`${dateKey}T00:00:00Z`);
  const dayEnd = zonedInstantExact(addDaysKey(dateKey, 1), 0, tz) ?? new Date(dayStart.getTime() + 26 * 3600_000);
  const taken = await sql.query<TakenRow>(
    `select start_at, end_at, status, hold_until from lessons
     where coach_id = $1 and start_at < $3 and end_at > $2 and status in ('held', 'confirmed')`,
    [coachId, dayStart.toISOString(), dayEnd.toISOString()],
  );

  const now = new Date();
  const slots: string[] = [];
  for (const h of hours) {
    for (let m = h.start_min; m + durationMin <= h.end_min; m += 60) {
      if (blocks.some((b) => overlapsBlock(m, durationMin, b.start_min, b.end_min))) continue;
      const start = zonedInstantExact(dateKey, m, tz);
      if (!start) continue;
      const end = new Date(start.getTime() + durationMin * 60 * 1000);
      if (start < now) continue;
      const clash = taken.some((l) => {
        if (l.status === "held" && !isHoldOpen(l.hold_until ? new Date(l.hold_until) : null)) return false;
        const ls = new Date(l.start_at);
        const le = new Date(l.end_at);
        return ls < end && le > start;
      });
      if (!clash) slots.push(start.toISOString());
    }
  }
  return slots;
}

/** Civil date of a slot start in the coach's time zone. */
export function slotDateKey(startIso: string, tz: string) {
  return dateKeyAt(new Date(startIso), tz);
}
