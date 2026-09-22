/**
 * Coach-side import of an existing student's recurring schedule — pure logic.
 *
 * A rule is a set of "weekday + wall-clock time" slots (several per week
 * allowed), repeated every week or every other week from startDate to endDate
 * inclusive, in the coach's time zone. endDate may be at most startDate plus
 * six calendar months. Every-other-week counts weeks from the Monday-based week
 * that contains startDate; all slots share that week parity.
 *
 * No I/O here (safe for the browser). The server builds on this in
 * recurring-service.ts.
 */
import { looksLikeEmail, normalizeEmail } from "./email";
import {
  addDaysKey,
  addMonthsKey,
  daysBetweenKeys,
  formatClockMinutes,
  formatDateKey,
  isDateKey,
  mondayOfKey,
  weekdayOf,
  zonedInstantExact,
} from "./time";

export const LESSON_DURATIONS = [30, 45, 60, 90, 120] as const;
export type LessonDuration = (typeof LESSON_DURATIONS)[number];

export const MAX_SLOTS = 14;
export const MAX_SPAN_MONTHS = 6;
export const LARGE_IMPORT = 30;

export const PAYMENT_STATUSES = [
  "unpaid",
  "pay_per_lesson",
  "prepaid_package",
  "monthly",
  "split",
  "outside_platform",
  "settled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pay_per_lesson: "Pay per lesson",
  prepaid_package: "Prepaid package",
  monthly: "Monthly",
  split: "Split payment",
  outside_platform: "Paid outside BookMe",
  settled: "Settled",
};

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function paymentStatusLabel(value: string | null | undefined) {
  return isPaymentStatus(value) ? PAYMENT_STATUS_LABEL[value] : "No payment note";
}

export function isLessonDuration(value: unknown): value is LessonDuration {
  return typeof value === "number" && (LESSON_DURATIONS as readonly number[]).includes(value);
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** Monday-first order for pickers. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type RecurringSlotInput = { weekday: number; startMin: number; durationMin?: number | null };

export type RecurringClientInput =
  | { kind: "existing"; id: string }
  | { kind: "new"; name: string; email?: string | null };

export type RecurringPaymentInput = {
  status?: string | null;
  note?: string | null;
  split?: string | null;
};

export type RecurringRuleInput = {
  client: RecurringClientInput;
  locationId?: string | null;
  slots: RecurringSlotInput[];
  startDate: string;
  endDate: string;
  intervalWeeks: number;
  payment?: RecurringPaymentInput | null;
  notifyStudent?: boolean;
};

export type NormalizedSlot = { weekday: number; startMin: number; durationMin: LessonDuration; durationChanged: boolean };

export type NormalizedRule = {
  client: { kind: "existing"; id: string } | { kind: "new"; name: string; email: string | null };
  locationId: string | null;
  slots: NormalizedSlot[];
  startDate: string;
  endDate: string;
  intervalWeeks: 1 | 2;
  payment: { status?: PaymentStatus | null; note?: string; split?: string };
  notifyStudent: boolean;
};

export function slotLabel(slot: { weekday: number; startMin: number; durationMin: number }) {
  return `${WEEKDAY_SHORT[slot.weekday]} ${formatClockMinutes(slot.startMin)}–${formatClockMinutes(slot.startMin + slot.durationMin)}`;
}

export function maxEndDate(startDate: string) {
  return addMonthsKey(startDate, MAX_SPAN_MONTHS);
}

type Fail = { ok: false; error: string };

export function normalizeRule(
  input: RecurringRuleInput,
  opts: { today: string; defaultDuration: number },
): { ok: true; rule: NormalizedRule } | Fail {
  if (!input || typeof input !== "object") return { ok: false, error: "Missing schedule." };

  // Client
  let client: NormalizedRule["client"];
  const c = input.client as RecurringClientInput | undefined;
  if (c?.kind === "existing") {
    const id = String(c.id || "").trim();
    if (!id) return { ok: false, error: "Pick a client." };
    client = { kind: "existing", id };
  } else if (c?.kind === "new") {
    const name = String(c.name || "").trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, error: "Enter the client's name." };
    if (name.length > 120) return { ok: false, error: "Client name is too long." };
    const rawEmail = String(c.email || "").trim();
    const email = rawEmail ? normalizeEmail(rawEmail) : null;
    if (email && !looksLikeEmail(email)) return { ok: false, error: "Enter a valid email, or leave it blank." };
    client = { kind: "new", name, email };
  } else {
    return { ok: false, error: "Pick a client." };
  }

  // Slots
  const rawSlots = Array.isArray(input.slots) ? input.slots : [];
  if (rawSlots.length === 0) return { ok: false, error: "Add at least one weekly time." };
  if (rawSlots.length > MAX_SLOTS) return { ok: false, error: `Use at most ${MAX_SLOTS} weekly times.` };
  if (!isLessonDuration(opts.defaultDuration)) return { ok: false, error: "Set a lesson length in setup first." };
  const slots: NormalizedSlot[] = [];
  for (const s of rawSlots) {
    const weekday = Number(s?.weekday);
    const startMin = Number(s?.startMin);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Pick a weekday for every time." };
    if (!Number.isInteger(startMin) || startMin < 0 || startMin > 1439) return { ok: false, error: "Pick a start time for every weekday." };
    const hasDuration = s?.durationMin != null;
    const durationMin = hasDuration ? Number(s.durationMin) : opts.defaultDuration;
    if (!isLessonDuration(durationMin)) return { ok: false, error: "Length must be 30, 45, 60, 90 or 120 minutes." };
    if (startMin + durationMin > 1440) {
      return { ok: false, error: `${slotLabel({ weekday, startMin, durationMin })} runs past midnight.` };
    }
    slots.push({ weekday, startMin, durationMin, durationChanged: durationMin !== opts.defaultDuration });
  }
  slots.sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i - 1];
    const cur = slots[i];
    if (prev.weekday === cur.weekday && cur.startMin < prev.startMin + prev.durationMin) {
      return { ok: false, error: `${slotLabel(prev)} and ${slotLabel(cur)} overlap.` };
    }
  }

  // Dates
  const startDate = String(input.startDate || "");
  const endDate = String(input.endDate || "");
  if (!isDateKey(startDate)) return { ok: false, error: "Pick a start date." };
  if (!isDateKey(endDate)) return { ok: false, error: "Pick an end date." };
  if (startDate < opts.today) return { ok: false, error: "Start date can't be in the past." };
  if (endDate < startDate) return { ok: false, error: "End date must be on or after the start date." };
  if (endDate > maxEndDate(startDate)) {
    return { ok: false, error: `End date can be at most 6 months after the start (${maxEndDate(startDate)}).` };
  }
  const intervalWeeks = Number(input.intervalWeeks);
  if (intervalWeeks !== 1 && intervalWeeks !== 2) return { ok: false, error: "Repeat every week or every 2 weeks." };

  // Payment (CRM note only). Undefined fields mean "use the client's values".
  const p = input.payment || {};
  const payment: NormalizedRule["payment"] = {};
  if (p.status !== undefined) {
    if (p.status === null || p.status === "") payment.status = null;
    else if (isPaymentStatus(p.status)) payment.status = p.status;
    else return { ok: false, error: "Unknown payment status." };
  }
  if (p.note !== undefined && p.note !== null) {
    const note = String(p.note).trim();
    if (note.length > 500) return { ok: false, error: "Payment note is too long (500 characters max)." };
    payment.note = note;
  }
  if (p.split !== undefined && p.split !== null) {
    const split = String(p.split).trim();
    if (split.length > 120) return { ok: false, error: "Split note is too long (120 characters max)." };
    payment.split = split;
  }

  const locationId = input.locationId ? String(input.locationId) : null;
  return {
    ok: true,
    rule: {
      client,
      locationId,
      slots,
      startDate,
      endDate,
      intervalWeeks,
      payment,
      notifyStudent: input.notifyStudent === true,
    },
  };
}

export type Occurrence = {
  dateKey: string;
  slotIndex: number;
  startMin: number;
  durationMin: number;
  /** null when the wall time does not exist that day (DST gap). */
  start: Date | null;
  end: Date | null;
};

/** Whether dateKey falls in an "on" week for the rule. */
export function inRepeatWeek(startDate: string, dateKey: string, intervalWeeks: 1 | 2) {
  if (intervalWeeks === 1) return true;
  const weeks = Math.floor(daysBetweenKeys(mondayOfKey(startDate), mondayOfKey(dateKey)) / 7);
  return weeks % 2 === 0;
}

export function expandOccurrences(
  rule: Pick<NormalizedRule, "slots" | "startDate" | "endDate" | "intervalWeeks">,
  tz: string,
): Occurrence[] {
  const out: Occurrence[] = [];
  const byWeekday = new Map<number, number[]>();
  rule.slots.forEach((s, i) => byWeekday.set(s.weekday, [...(byWeekday.get(s.weekday) || []), i]));
  for (let key = rule.startDate; key <= rule.endDate; key = addDaysKey(key, 1)) {
    const idxs = byWeekday.get(weekdayOf(key));
    if (!idxs || !inRepeatWeek(rule.startDate, key, rule.intervalWeeks)) continue;
    for (const i of idxs) {
      const slot = rule.slots[i];
      const start = zonedInstantExact(key, slot.startMin, tz);
      const end = start ? new Date(start.getTime() + slot.durationMin * 60_000) : null;
      out.push({ dateKey: key, slotIndex: i, startMin: slot.startMin, durationMin: slot.durationMin, start, end });
    }
  }
  return out;
}

export type TakenLesson = {
  id: string;
  start: Date;
  end: Date;
  status: string;
  holdUntil: Date | null;
  clientName: string;
};

export type DateBlock = { date: string; startMin: number; endMin: number };

export type SkipReason = "past" | "time_missing" | "blocked" | "lesson" | "hold";

export type Conflict = { reason: SkipReason; detail: string };

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  past: "Time has already passed",
  time_missing: "Clock change — this time doesn't exist that day",
  blocked: "Day is blocked",
  lesson: "Overlaps a booked lesson",
  hold: "Overlaps a booking in checkout",
};

function firstName(name: string) {
  return String(name || "").trim().split(/\s+/)[0] || "another student";
}

/**
 * Why a time can't be used, or null when it is free. Blocks are compared on
 * the civil date in the coach's zone; lessons and open holds by instant.
 */
export function conflictFor(
  slot: { dateKey: string; startMin: number; durationMin: number; start: Date | null; end: Date | null },
  taken: TakenLesson[],
  blocks: DateBlock[],
  now: Date,
  opts: { ignoreLessonId?: string } = {},
): Conflict | null {
  if (!slot.start || !slot.end) return { reason: "time_missing", detail: SKIP_REASON_LABEL.time_missing };
  if (slot.start.getTime() < now.getTime()) return { reason: "past", detail: SKIP_REASON_LABEL.past };
  const blocked = blocks.some(
    (b) => b.date === slot.dateKey && slot.startMin < (b.endMin ?? 1440) && slot.startMin + slot.durationMin > (b.startMin ?? 0),
  );
  if (blocked) return { reason: "blocked", detail: SKIP_REASON_LABEL.blocked };
  for (const t of taken) {
    if (t.id === opts.ignoreLessonId) continue;
    if (!(t.start < slot.end && t.end > slot.start)) continue;
    if (t.status === "confirmed") {
      return { reason: "lesson", detail: `Overlaps ${firstName(t.clientName)}'s lesson` };
    }
    if (t.status === "held" && t.holdUntil && t.holdUntil.getTime() > now.getTime()) {
      return { reason: "hold", detail: SKIP_REASON_LABEL.hold };
    }
  }
  return null;
}

export type WeeklyHour = { weekday: number; startMin: number; endMin: number };

/** True when the slot is not fully inside one of the coach's public hour ranges. */
export function isOutsideHours(slot: { weekday: number; startMin: number; durationMin: number }, hours: WeeklyHour[]) {
  return !hours.some(
    (h) => h.weekday === slot.weekday && h.startMin <= slot.startMin && slot.startMin + slot.durationMin <= h.endMin,
  );
}

export type RecurringPreviewSlot = {
  weekday: number;
  startMin: number;
  durationMin: number;
  label: string;
  durationChanged: boolean;
  outsideHours: boolean;
};

export type RecurringPreviewSkip = {
  dateKey: string;
  dateLabel: string;
  slotLabel: string;
  reason: SkipReason;
  detail: string;
};

/** What the confirm card shows. Built on the server, rendered in the browser. */
export type RecurringPreview = {
  client: { mode: "existing" | "new"; id: string | null; name: string; email: string | null };
  location: { id: string; name: string };
  timezone: string;
  startDate: string;
  endDate: string;
  startLabel: string;
  endLabel: string;
  intervalWeeks: 1 | 2;
  slots: RecurringPreviewSlot[];
  createCount: number;
  skipCount: number;
  skipped: RecurringPreviewSkip[];
  outsideHours: boolean;
  activeSeriesCount: number;
  payment: { status: PaymentStatus | null; statusLabel: string; note: string; split: string };
  notifyStudent: boolean;
  remindersOn: boolean;
  fingerprint: string;
};

export function dateLabel(dateKey: string) {
  return formatDateKey(dateKey, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function repeatLabel(intervalWeeks: number) {
  return intervalWeeks === 2 ? "Every 2 weeks" : "Every week";
}

/** Recap for the assistant, in the coach's language. */
export function recapImport(p: RecurringPreview, lang: "zh" | "en") {
  const slots = p.slots.map((s) => s.label).join(", ");
  const skipped = p.skipped.slice(0, 5).map((s) => `${s.dateKey} ${s.slotLabel.split(" ")[0]}`);
  const more = p.skipped.length > 5 ? (lang === "zh" ? ` 等 ${p.skipped.length} 个` : ` and ${p.skipped.length - 5} more`) : "";
  const pay = [p.payment.status ? p.payment.statusLabel : "", p.payment.note, p.payment.split].filter(Boolean).join(" · ");
  if (lang === "zh") {
    return [
      `为 ${p.client.name}${p.client.email ? `（${p.client.email}）` : "（无邮箱，学员门户/站内信无法登录）"}导入固定课表：`,
      `${p.intervalWeeks === 2 ? "每两周" : "每周"} ${slots}（${p.timezone}）`,
      `${p.startDate} 至 ${p.endDate}，共 ${p.createCount} 节，冲突跳过 ${p.skipCount} 节${p.skipCount ? `：${skipped.join("、")}${more}` : ""}。`,
      p.outsideHours ? "部分时间不在公开营业时间，仍将占档。" : "",
      `支付备注：${pay || "无"}。不会创建 Stripe 扣款。`,
      `回复「确认导入」或点确认后才会写入。`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Import a recurring schedule for ${p.client.name}${p.client.email ? ` (${p.client.email})` : " (no email — no portal or messages)"}:`,
    `${repeatLabel(p.intervalWeeks)}: ${slots} (${p.timezone})`,
    `${p.startDate} to ${p.endDate}: ${p.createCount} lessons, ${p.skipCount} skipped for conflicts${p.skipCount ? `: ${skipped.join(", ")}${more}` : ""}.`,
    p.outsideHours ? "Some times are outside your public hours and will still hold the slot." : "",
    `Payment note: ${pay || "none"}. No Stripe charge will be created.`,
    `Nothing is saved until you confirm (reply "confirm import" or tap Confirm).`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function detectLang(text: string): "zh" | "en" {
  return /[\u3400-\u9fff]/.test(String(text || "")) ? "zh" : "en";
}

const CONFIRM_IMPORT = /^\s*(确认导入|確認導入|confirm import)\s*[.!。！]?\s*$/i;

export function isConfirmImportText(text: string) {
  return CONFIRM_IMPORT.test(String(text || ""));
}

/** Parse "HH:MM" (24h) into minutes after midnight. */
export function parseClock(value: string) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function clockValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
