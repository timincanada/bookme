/**
 * Server functions for importing and managing recurring schedules.
 * Every function is coach-scoped via authMiddleware + coachForUser.
 */
import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql, lockCoachSchedule, withTransaction } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { coachForUser, importCoachFrom, loadCoachBundle, sendImportNotice } from "./api";
import { publicAppUrl as appUrl } from "./app-url";
import { lessonStatusLabel, payLabel } from "./bookings";
import { recurringEndedMail, sendMail } from "./mail";
import {
  dateLabel,
  isPaymentStatus,
  LESSON_DURATIONS,
  maxEndDate,
  paymentStatusLabel,
  repeatLabel,
  slotLabel,
  type PaymentStatus,
  type RecurringPreview,
  type RecurringRuleInput,
} from "./recurring";
import { buildImportPlan, confirmImport, endSeries } from "./recurring-service";
import { formatWhen, todayKey } from "./time";

function asDate(v: string | Date | null) {
  return v ? (v instanceof Date ? v : new Date(v)) : null;
}

function dateText(v: string | Date | null) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

type PaymentInput = { status?: string | null; note?: string | null; split?: string | null };

function cleanPayment(input: PaymentInput):
  | { ok: true; status: PaymentStatus | null; note: string; split: string }
  | { ok: false; error: string } {
  const status = input.status ? String(input.status) : null;
  if (status && !isPaymentStatus(status)) return { ok: false, error: "Unknown payment status." };
  const note = String(input.note || "").trim();
  const split = String(input.split || "").trim();
  if (note.length > 500) return { ok: false, error: "Payment note is too long (500 characters max)." };
  if (split.length > 120) return { ok: false, error: "Split note is too long (120 characters max)." };
  return { ok: true, status: status as PaymentStatus | null, note, split };
}

async function coachContext(userId: string) {
  const sql = await getSql();
  const coach = await coachForUser(sql, userId);
  if (!coach) return null;
  const bundle = await loadCoachBundle(sql, coach);
  return { sql, coach, bundle, importCoach: importCoachFrom(coach, bundle) };
}

/** Everything the import form needs. */
export const getImportContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = await coachContext(context.userId);
    if (!ctx) return { ok: false as const, error: "Sign in required" };
    const { sql, coach, importCoach } = ctx;
    const clients = await sql.query<{
      id: string;
      name: string;
      email: string | null;
      payment_status: string | null;
      payment_note: string;
      split_ratio: string;
    }>(
      `select id, name, email, payment_status, payment_note, split_ratio from clients where coach_id = $1 order by name`,
      [coach.id],
    );
    const today = todayKey(importCoach.timezone);
    return {
      ok: true as const,
      open: importCoach.open,
      timezone: importCoach.timezone,
      today,
      maxEnd: maxEndDate(today),
      defaultDuration: importCoach.service?.duration ?? 60,
      durations: importCoach.service?.durations?.length
        ? [...importCoach.service.durations]
        : [...LESSON_DURATIONS],
      locations: importCoach.locations,
      hours: importCoach.hours,
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        paymentStatus: c.payment_status,
        paymentNote: c.payment_note,
        splitRatio: c.split_ratio,
      })),
    };
  });

export const previewRecurringImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { rule: RecurringRuleInput }) => guardInput(input))
  .handler(async ({ context, data }): Promise<{ ok: true; preview: RecurringPreview } | { ok: false; error: string }> => {
    const ctx = await coachContext(context.userId);
    if (!ctx) return { ok: false, error: "Sign in required" };
    const built = await buildImportPlan(ctx.sql, ctx.importCoach, data.rule);
    if (!built.ok) return built;
    return { ok: true, preview: built.plan.preview };
  });

export const confirmRecurringImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { rule: RecurringRuleInput; fingerprint: string }) => guardInput(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<
      | { ok: true; seriesId: string; created: number; skipped: number }
      | { ok: false; error: string; preview?: RecurringPreview }
    > => {
      const ctx = await coachContext(context.userId);
      if (!ctx) return { ok: false, error: "Sign in required" };
      const result = await withTransaction(async (tx) => {
        await lockCoachSchedule(tx, ctx.coach.id);
        return confirmImport(tx, ctx.importCoach, data.rule, String(data.fingerprint || ""), "form");
      });
      if (!result.ok) {
        return result.stale ? { ok: false, error: result.error, preview: result.preview } : { ok: false, error: result.error };
      }
      await sendImportNotice(ctx.coach, result.done);
      return { ok: true, seriesId: result.done.seriesId, created: result.done.created, skipped: result.done.skipped };
    },
  );

export const getSeries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const rows = await sql.query<{
      id: string;
      client_id: string;
      client_name: string;
      client_email: string | null;
      location_name: string;
      interval_weeks: number;
      start_date: string | Date;
      end_date: string | Date;
      timezone: string;
      status: string;
      ended_from: string | Date | null;
      payment_status: string | null;
      payment_note: string;
      split_ratio: string;
      lesson_count: number;
      skipped_count: number;
      created_via: string;
    }>(
      `select s.id, s.client_id, cl.name as client_name, cl.email as client_email, loc.name as location_name,
              s.interval_weeks, s.start_date::text as start_date, s.end_date::text as end_date, s.timezone, s.status,
              s.ended_from::text as ended_from, s.payment_status, s.payment_note, s.split_ratio,
              s.lesson_count, s.skipped_count, s.created_via
       from recurring_series s
       join clients cl on cl.id = s.client_id
       join locations loc on loc.id = s.location_id
       where s.id = $1 and s.coach_id = $2`,
      [data.id, coach.id],
    );
    const s = rows[0];
    if (!s) return { ok: false as const, error: "Schedule not found" };
    const slots = await sql.query<{ weekday: number; start_min: number; duration_min: number }>(
      `select weekday, start_min, duration_min from recurring_slots where series_id = $1 order by weekday, start_min`,
      [s.id],
    );
    const lessons = await sql.query<{ id: string; start_at: string | Date; status: string; pay_status: string | null; pay_method: string | null }>(
      `select l.id, l.start_at, l.status, p.status as pay_status, p.method as pay_method
       from lessons l left join payments p on p.lesson_id = l.id
       where l.series_id = $1 and l.coach_id = $2
       order by l.start_at`,
      [s.id, coach.id],
    );
    const now = Date.now();
    const label = paymentStatusLabel(s.payment_status);
    return {
      ok: true as const,
      series: {
        id: s.id,
        clientId: s.client_id,
        clientName: s.client_name,
        clientEmail: s.client_email,
        locationName: s.location_name,
        repeat: repeatLabel(s.interval_weeks),
        startDate: dateText(s.start_date),
        endDate: dateText(s.end_date),
        startLabel: dateLabel(dateText(s.start_date)),
        endLabel: dateLabel(dateText(s.end_date)),
        timezone: s.timezone,
        today: todayKey(s.timezone),
        status: s.status,
        endedFrom: s.ended_from ? dateText(s.ended_from) : null,
        paymentStatus: s.payment_status,
        paymentNote: s.payment_note,
        splitRatio: s.split_ratio,
        lessonCount: Number(s.lesson_count),
        skippedCount: Number(s.skipped_count),
        createdVia: s.created_via,
        slots: slots.map((sl) => slotLabel({ weekday: sl.weekday, startMin: sl.start_min, durationMin: sl.duration_min })),
      },
      lessons: lessons.map((l) => {
        const start = asDate(l.start_at)!;
        return {
          id: l.id,
          when: formatWhen(start, s.timezone),
          upcoming: start.getTime() >= now,
          status: l.status,
          statusLabel: lessonStatusLabel(l.status),
          pay: payLabel(l.pay_status, l.pay_method, { audience: "coach", seriesStatusLabel: label }),
        };
      }),
    };
  });

export const listClientSeries = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const client = (
      await sql.query<{ id: string; payment_status: string | null; payment_note: string; split_ratio: string }>(
        `select id, payment_status, payment_note, split_ratio from clients where id = $1 and coach_id = $2`,
        [data.clientId, coach.id],
      )
    )[0];
    if (!client) return { ok: false as const, error: "Client not found" };
    const series = await sql.query<{
      id: string;
      interval_weeks: number;
      start_date: string;
      end_date: string;
      status: string;
      payment_status: string | null;
    }>(
      `select id, interval_weeks, start_date::text as start_date, end_date::text as end_date, status, payment_status
       from recurring_series where coach_id = $1 and client_id = $2 order by start_date desc`,
      [coach.id, client.id],
    );
    const slots = await sql.query<{ series_id: string; weekday: number; start_min: number; duration_min: number }>(
      `select sl.series_id, sl.weekday, sl.start_min, sl.duration_min
       from recurring_slots sl join recurring_series s on s.id = sl.series_id
       where s.coach_id = $1 and s.client_id = $2
       order by sl.weekday, sl.start_min`,
      [coach.id, client.id],
    );
    return {
      ok: true as const,
      payment: { status: client.payment_status, note: client.payment_note, split: client.split_ratio },
      series: series.map((s) => ({
        id: s.id,
        repeat: repeatLabel(s.interval_weeks),
        dates: `${dateLabel(dateText(s.start_date))} – ${dateLabel(dateText(s.end_date))}`,
        status: s.status,
        paymentLabel: paymentStatusLabel(s.payment_status),
        slots: slots
          .filter((sl) => sl.series_id === s.id)
          .map((sl) => slotLabel({ weekday: sl.weekday, startMin: sl.start_min, durationMin: sl.duration_min })),
      })),
    };
  });

/** Series-level payment note only; the client's own note is separate. */
export const updateSeriesPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string } & PaymentInput) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const p = cleanPayment(data);
    if (!p.ok) return p;
    const rows = await sql.query<{ id: string }>(
      `update recurring_series set payment_status = $1, payment_note = $2, split_ratio = $3
       where id = $4 and coach_id = $5 returning id`,
      [p.status, p.note, p.split, data.id, coach.id],
    );
    if (!rows[0]) return { ok: false as const, error: "Schedule not found" };
    return { ok: true as const };
  });

/** Client-level payment note only; existing series are not changed. */
export const saveClientPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string } & PaymentInput) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const p = cleanPayment(data);
    if (!p.ok) return p;
    const rows = await sql.query<{ id: string }>(
      `update clients set payment_status = $1, payment_note = $2, split_ratio = $3
       where id = $4 and coach_id = $5 returning id`,
      [p.status, p.note, p.split, data.clientId, coach.id],
    );
    if (!rows[0]) return { ok: false as const, error: "Client not found" };
    return { ok: true as const };
  });

export const endRecurringSeries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; fromDate: string; notify?: boolean }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const result = await withTransaction(async (tx) => {
      await lockCoachSchedule(tx, coach.id);
      return endSeries(tx, coach.id, String(data.id || ""), String(data.fromDate || ""));
    });
    if (!result.ok) return result;
    const done = result.done;
    if (data.notify === true && done.clientEmail) {
      await sendMail(
        recurringEndedMail({
          studentEmail: done.clientEmail,
          studentName: done.clientName,
          coachName: coach.name,
          fromLabel: dateLabel(done.fromDate),
          cancelled: done.cancelled,
          manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(done.clientEmail)}`,
        }),
        { template: "recurring_ended" },
      );
    }
    return { ok: true as const, cancelled: done.cancelled };
  });
