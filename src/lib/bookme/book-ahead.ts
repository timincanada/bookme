import { addDaysKey } from "./time";

export const BOOK_AHEAD_OPTIONS = [
  { days: 2, label: "2 days" },
  { days: 3, label: "3 days" },
  { days: 5, label: "5 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 84, label: "12 weeks" },
] as const;

export const DEFAULT_BOOK_AHEAD_DAYS = 28;
export const MIN_BOOK_AHEAD_DAYS = 1;
export const MAX_BOOK_AHEAD_DAYS = 120;

/** Any whole number of days from 1 to 120; the options above are shortcuts. */
export function normalizeBookAheadDays(value: unknown) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_BOOK_AHEAD_DAYS || n > MAX_BOOK_AHEAD_DAYS) return DEFAULT_BOOK_AHEAD_DAYS;
  return n;
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
  return BOOK_AHEAD_OPTIONS.find((o) => o.days === n)?.label ?? (n === 1 ? "1 day" : `${n} days`);
}
