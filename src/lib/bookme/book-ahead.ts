import { addDaysKey } from "./time";

export const BOOK_AHEAD_OPTIONS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 84, label: "12 weeks" },
] as const;

export const DEFAULT_BOOK_AHEAD_DAYS = 28;

const ALLOWED = new Set<number>(BOOK_AHEAD_OPTIONS.map((o) => o.days));

export function normalizeBookAheadDays(value: unknown) {
  const n = Number(value);
  if (ALLOWED.has(n)) return n;
  return DEFAULT_BOOK_AHEAD_DAYS;
}

/**
 * Inclusive last civil date students may pick (today counts as day 1).
 * `today` is the coach's civil date (see todayKey(tz)).
 */
export function lastBookableDateKey(days: number, today: string) {
  const n = Math.max(1, normalizeBookAheadDays(days));
  return addDaysKey(today, n - 1);
}

export function isWithinBookAhead(dateKey: string, days: number, today: string) {
  if (!dateKey || dateKey < today) return false;
  return dateKey <= lastBookableDateKey(days, today);
}

export function bookAheadLabel(days: number) {
  const n = normalizeBookAheadDays(days);
  return BOOK_AHEAD_OPTIONS.find((o) => o.days === n)?.label ?? `${n} days`;
}
