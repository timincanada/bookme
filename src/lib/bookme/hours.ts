export const MAX_SEGMENTS_PER_DAY = 3;

export type HourSegment = {
  weekday: number;
  startMin: number;
  endMin: number;
};

export function endAfterStart(startMin: number, endMin: number): boolean {
  return Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin;
}

export function segmentsOverlap(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function validateDaySegments(
  segments: Array<{ startMin: number; endMin: number }>,
): { ok: true } | { ok: false; error: string } {
  if (segments.length === 0) return { ok: true };
  if (segments.length > MAX_SEGMENTS_PER_DAY) {
    return { ok: false, error: "At most 3 segments per day" };
  }
  for (const s of segments) {
    if (!endAfterStart(s.startMin, s.endMin)) {
      return { ok: false, error: "End must be after start" };
    }
  }
  const sorted = [...segments].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  for (let i = 1; i < sorted.length; i++) {
    if (segmentsOverlap(sorted[i - 1], sorted[i])) {
      return { ok: false, error: "Segments must not overlap" };
    }
  }
  return { ok: true };
}

export function validateWeeklyHours(
  hours: HourSegment[],
): { ok: true; rows: HourSegment[] } | { ok: false; error: string } {
  if (!Array.isArray(hours) || hours.length === 0) {
    return { ok: false, error: "Keep at least one weekly window" };
  }
  const rows: HourSegment[] = [];
  const byDay = new Map<number, HourSegment[]>();
  for (const raw of hours) {
    const weekday = Number(raw.weekday);
    const startMin = Number(raw.startMin);
    const endMin = Number(raw.endMin);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, error: "Invalid weekday" };
    }
    const seg = { weekday, startMin, endMin };
    rows.push(seg);
    const list = byDay.get(weekday) || [];
    list.push(seg);
    byDay.set(weekday, list);
  }
  for (const [, segs] of byDay) {
    const r = validateDaySegments(segs);
    if (!r.ok) return r;
  }
  return { ok: true, rows };
}

export function dayError(hours: HourSegment[], weekday: number): string | null {
  const segs = hours.filter((h) => h.weekday === weekday);
  const r = validateDaySegments(segs);
  return r.ok ? null : r.error;
}

export function clock(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function parseClock(value: string): number {
  const [hh, mm] = value.split(":").map(Number);
  return hh * 60 + mm;
}
