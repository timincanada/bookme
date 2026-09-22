/**
 * Operations console — pure helpers (no I/O): roles, money, reporting periods,
 * health thresholds, CSV. All reporting is in the platform time zone.
 */
import { addDaysKey, dateKeyAt, mondayOfKey, todayKey } from "./time";

export const REPORT_TIMEZONE = "America/Toronto";
/** BookMe's share of a card payment. */
export const PLATFORM_FEE_RATE = 0.05;

export type AdminRole = "owner" | "admin";

export type AdminAbility =
  | "view"
  | "lookup_student"
  | "extend_trial"
  | "set_access"
  | "ban_coach"
  | "manage_team";

const ABILITIES: Record<AdminRole, AdminAbility[]> = {
  owner: ["view", "lookup_student", "extend_trial", "set_access", "ban_coach", "manage_team"],
  admin: ["view", "lookup_student", "extend_trial"],
};

export function can(role: AdminRole | null | undefined, ability: AdminAbility) {
  return Boolean(role && ABILITIES[role]?.includes(ability));
}

export function platformFeeCad(cardPaidCad: number) {
  return Math.round(cardPaidCad * PLATFORM_FEE_RATE * 100) / 100;
}

export function formatCad(amount: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(amount);
}

export function pct(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export type PeriodKey = "today" | "week" | "month" | "all";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

/** Inclusive civil date range for a period, in the platform time zone. */
export function periodRange(period: PeriodKey, now = new Date()) {
  const today = todayKey(REPORT_TIMEZONE, now);
  if (period === "today") return { from: today, to: today };
  if (period === "week") return { from: mondayOfKey(today), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: "1970-01-01", to: today };
}

/** The last `count` months (oldest first) as YYYY-MM. */
export function recentMonths(count: number, now = new Date()) {
  const [y, m] = todayKey(REPORT_TIMEZONE, now).slice(0, 7).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const total = y * 12 + (m - 1) - (count - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}

export type AttentionItem = { kind: string; label: string; count: number; href?: string };

/** Sorted "needs a look" list for the summary page (only non-empty items). */
export function attentionList(counts: Record<string, number>): AttentionItem[] {
  const defs: { kind: string; label: string; href?: string }[] = [
    { kind: "trialEndingSoon", label: "Trials ending within 3 days", href: "/admin/coaches" },
    { kind: "pastDue", label: "Subscriptions past due or canceled with upcoming lessons", href: "/admin/coaches" },
    { kind: "cardWithoutStripe", label: "Coaches accepting cards without Stripe connected", href: "/admin/coaches" },
    { kind: "stuckHolds", label: "Checkout holds stuck in 'held'", href: "/admin/lessons" },
    { kind: "lessonsWithoutPayment", label: "Confirmed lessons with no payment row", href: "/admin/lessons" },
    { kind: "pendingPurge", label: "Deleted coach accounts awaiting purge", href: "/admin/health" },
  ];
  return defs
    .map((d) => ({ ...d, count: Number(counts[d.kind] ?? 0) }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function jobFreshness(lastRunAt: Date | null, now = new Date()) {
  if (!lastRunAt) return { state: "never" as const, text: "never run" };
  const hours = (now.getTime() - lastRunAt.getTime()) / 3_600_000;
  if (hours > 26) return { state: "stale" as const, text: `${Math.round(hours)} h ago` };
  return { state: "ok" as const, text: hours < 1 ? "under an hour ago" : `${Math.round(hours)} h ago` };
}

/** Students are shown as "Student #n" with an initial; never by name or email. */
export function studentLabel(index: number, name?: string | null) {
  const initial = String(name || "").trim().charAt(0).toUpperCase();
  return initial ? `Student #${index} (${initial}.)` : `Student #${index}`;
}

export function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]) {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

export function exportFilename(kind: string, ext: "csv" | "xlsx", now = new Date()) {
  return `bookme-${kind}-${dateKeyAt(now, REPORT_TIMEZONE)}.${ext}`;
}

/** Civil date range validation for filters (max 400 days). */
export function cleanRange(from?: string | null, to?: string | null, now = new Date()) {
  const today = todayKey(REPORT_TIMEZONE, now);
  const valid = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const end = valid(to) ?? today;
  const start = valid(from) ?? addDaysKey(end, -29);
  if (start > end) return { from: end, to: end };
  if (addDaysKey(start, 400) < end) return { from: addDaysKey(end, -400), to: end };
  return { from: start, to: end };
}

/** Chip colour for a coach's subscription state. */
export function subscriptionTone(status: string, banned: boolean): "muted" | "good" | "warn" | "bad" {
  if (banned) return "bad";
  if (status === "active") return "good";
  if (status === "trialing") return "warn";
  return "muted";
}
