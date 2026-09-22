/**
 * Recurring-schedule import — server side (database + fingerprint).
 *
 * preview and confirm share buildImportPlan(). confirmImport() re-runs it under
 * the coach's schedule lock inside the caller's transaction and only writes
 * when the result matches the fingerprint the coach saw.
 */
import { createHash, randomUUID } from "crypto";
import type { Sql } from "@/lib/db";
import { findOrCreateCoachClient, getCoachClient } from "./clients-db";
import {
  conflictFor,
  dateLabel,
  expandOccurrences,
  isOutsideHours,
  normalizeRule,
  paymentStatusLabel,
  slotLabel,
  type DateBlock,
  type NormalizedRule,
  type Occurrence,
  type PaymentStatus,
  type RecurringPreview,
  type RecurringRuleInput,
  type TakenLesson,
  type WeeklyHour,
} from "./recurring";
import { addDaysKey, todayKey, zonedInstant } from "./time";
import { isValidTimezone } from "./timezone";

type QuerySql = Pick<Sql, "query">;

export type ImportCoach = {
  id: string;
  timezone: string;
  open: boolean;
  service: { id: string; duration: number } | null;
  locations: { id: string; name: string }[];
  hours: WeeklyHour[];
};

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  payment_status: string | null;
  payment_note: string;
  split_ratio: string;
};

export type ImportPlan = {
  rule: NormalizedRule;
  coachId: string;
  serviceId: string;
  clientId: string | null;
  create: Occurrence[];
  payment: { status: PaymentStatus | null; note: string; split: string };
  preview: RecurringPreview;
};

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function asDate(v: string | Date | null) {
  return v ? (v instanceof Date ? v : new Date(v)) : null;
}

export function fingerprintOf(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buildImportPlan(
  sql: QuerySql,
  coach: ImportCoach,
  input: RecurringRuleInput,
  now = new Date(),
): Promise<Result<{ plan: ImportPlan }>> {
  if (!coach.open) {
    return { ok: false, error: "Finish setup and keep your trial or plan active to import lessons." };
  }
  if (!coach.service) return { ok: false, error: "Add your lesson type in setup first." };
  if (!coach.locations.length) return { ok: false, error: "Turn on at least one location first." };
  const tz = coach.timezone;
  if (!isValidTimezone(tz)) return { ok: false, error: "Set your time zone in setup first." };
  const today = todayKey(tz, now);

  const norm = normalizeRule(input, { today, defaultDuration: coach.service.duration });
  if (!norm.ok) return norm;
  const rule = norm.rule;

  const location = rule.locationId
    ? coach.locations.find((l) => l.id === rule.locationId)
    : coach.locations[0];
  if (!location) return { ok: false, error: "Pick one of your active locations." };

  // Client: only ever this coach's record.
  let clientRow: ClientRow | null = null;
  if (rule.client.kind === "existing") {
    const found = await getCoachClient(sql, coach.id, rule.client.id);
    if (!found) return { ok: false, error: "Client not found." };
    clientRow = (
      await sql.query<ClientRow>(
        `select id, name, email, payment_status, payment_note, split_ratio from clients where id = $1 and coach_id = $2`,
        [found.id, coach.id],
      )
    )[0];
  } else if (rule.client.email) {
    clientRow =
      (
        await sql.query<ClientRow>(
          `select id, name, email, payment_status, payment_note, split_ratio
           from clients where coach_id = $1 and lower(email) = lower($2) limit 1`,
          [coach.id, rule.client.email],
        )
      )[0] ?? null;
  }
  const client = clientRow
    ? { mode: "existing" as const, id: clientRow.id, name: clientRow.name, email: clientRow.email }
    : {
        mode: "new" as const,
        id: null,
        name: rule.client.kind === "new" ? rule.client.name : "",
        email: rule.client.kind === "new" ? rule.client.email : null,
      };

  // Series payment note = the client's values unless this import sets them.
  const base = {
    status: (clientRow?.payment_status as PaymentStatus | null) ?? null,
    note: clientRow?.payment_note ?? "",
    split: clientRow?.split_ratio ?? "",
  };
  const payment = {
    status: rule.payment.status !== undefined ? rule.payment.status : base.status,
    note: rule.payment.note !== undefined ? rule.payment.note : base.note,
    split: rule.payment.split !== undefined ? rule.payment.split : base.split,
  };

  const occurrences = expandOccurrences(rule, tz);
  if (!occurrences.length) return { ok: false, error: "None of those weekdays fall between the start and end dates." };

  const rangeStart = zonedInstant(rule.startDate, 0, tz);
  const rangeEnd = zonedInstant(addDaysKey(rule.endDate, 1), 0, tz);
  const takenRows = await sql.query<{
    id: string;
    start_at: string | Date;
    end_at: string | Date;
    status: string;
    hold_until: string | Date | null;
    client_name: string;
  }>(
    `select l.id, l.start_at, l.end_at, l.status, l.hold_until, cl.name as client_name
     from lessons l join clients cl on cl.id = l.client_id
     where l.coach_id = $1 and l.status in ('confirmed', 'held')
       and l.start_at < $3 and l.end_at > $2`,
    [coach.id, rangeStart.toISOString(), rangeEnd.toISOString()],
  );
  const taken: TakenLesson[] = takenRows.map((r) => ({
    id: r.id,
    start: asDate(r.start_at)!,
    end: asDate(r.end_at)!,
    status: r.status,
    holdUntil: asDate(r.hold_until),
    clientName: r.client_name,
  }));
  const blocks = (
    await sql.query<{ date: string; start_min: number; end_min: number }>(
      `select date, start_min, end_min from date_blocks where coach_id = $1 and date >= $2 and date <= $3`,
      [coach.id, rule.startDate, rule.endDate],
    )
  ).map((b): DateBlock => ({ date: b.date, startMin: b.start_min, endMin: b.end_min }));

  const create: Occurrence[] = [];
  const skipped: RecurringPreview["skipped"] = [];
  for (const occ of occurrences) {
    const conflict = conflictFor(occ, taken, blocks, now);
    const slot = rule.slots[occ.slotIndex];
    if (conflict) {
      skipped.push({
        dateKey: occ.dateKey,
        dateLabel: dateLabel(occ.dateKey),
        slotLabel: slotLabel(slot),
        reason: conflict.reason,
        detail: conflict.detail,
      });
    } else {
      create.push(occ);
    }
  }

  const activeSeriesCount = clientRow
    ? Number(
        (
          await sql.query<{ n: number }>(
            `select count(*)::int as n from recurring_series
             where coach_id = $1 and client_id = $2 and status = 'active' and end_date >= $3`,
            [coach.id, clientRow.id, today],
          )
        )[0]?.n ?? 0,
      )
    : 0;

  const slots = rule.slots.map((s) => ({
    weekday: s.weekday,
    startMin: s.startMin,
    durationMin: s.durationMin,
    label: slotLabel(s),
    durationChanged: s.durationChanged,
    outsideHours: isOutsideHours(s, coach.hours),
  }));

  const fingerprint = fingerprintOf({
    v: 1,
    coach: coach.id,
    tz,
    client: [client.mode, client.id, client.name, client.email],
    location: location.id,
    service: coach.service.id,
    slots: rule.slots.map((s) => [s.weekday, s.startMin, s.durationMin]),
    interval: rule.intervalWeeks,
    dates: [rule.startDate, rule.endDate],
    payment,
    notify: rule.notifyStudent,
    create: create.map((o) => o.start!.toISOString() + "/" + o.durationMin),
    skip: skipped.map((s) => [s.dateKey, s.slotLabel, s.reason]),
  });

  const preview: RecurringPreview = {
    client,
    location: { id: location.id, name: location.name },
    timezone: tz,
    startDate: rule.startDate,
    endDate: rule.endDate,
    startLabel: dateLabel(rule.startDate),
    endLabel: dateLabel(rule.endDate),
    intervalWeeks: rule.intervalWeeks,
    slots,
    createCount: create.length,
    skipCount: skipped.length,
    skipped,
    outsideHours: slots.some((s) => s.outsideHours),
    activeSeriesCount,
    payment: { status: payment.status, statusLabel: paymentStatusLabel(payment.status), note: payment.note, split: payment.split },
    notifyStudent: rule.notifyStudent && Boolean(client.email),
    remindersOn: Boolean(client.email),
    fingerprint,
  };

  return {
    ok: true,
    plan: {
      rule,
      coachId: coach.id,
      serviceId: coach.service.id,
      clientId: clientRow?.id ?? null,
      create,
      payment,
      preview,
    },
  };
}

export type ImportDone = {
  seriesId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  created: number;
  skipped: number;
  preview: RecurringPreview;
};

/**
 * Write the import. The caller must hold a transaction and have taken
 * lockCoachSchedule(tx, coach.id) first.
 */
export async function confirmImport(
  tx: QuerySql,
  coach: ImportCoach,
  input: RecurringRuleInput,
  fingerprint: string,
  createdVia: "form" | "assistant",
  now = new Date(),
): Promise<
  | { ok: true; done: ImportDone }
  | { ok: false; error: string; stale?: false }
  | { ok: false; error: string; stale: true; preview: RecurringPreview }
> {
  const built = await buildImportPlan(tx, coach, input, now);
  if (!built.ok) return built;
  const { plan } = built;
  if (!fingerprint || plan.preview.fingerprint !== fingerprint) {
    return {
      ok: false,
      stale: true,
      error: "Your calendar changed since the preview. Check the updated numbers and confirm again.",
      preview: plan.preview,
    };
  }
  if (!plan.create.length) return { ok: false, error: "Nothing to import — every date is skipped." };

  // Client (this coach only).
  let clientId = plan.clientId;
  const p = plan.preview.client;
  if (!clientId) {
    if (p.email) {
      const made = await findOrCreateCoachClient(tx, coach.id, { id: randomUUID(), name: p.name, email: p.email });
      clientId = made.id;
      if (made.created) {
        await tx.query(
          `update clients set payment_status = $1, payment_note = $2, split_ratio = $3 where id = $4 and coach_id = $5`,
          [plan.payment.status, plan.payment.note, plan.payment.split, clientId, coach.id],
        );
      }
    } else {
      clientId = randomUUID();
      await tx.query(
        `insert into clients (id, coach_id, name, email, payment_status, payment_note, split_ratio)
         values ($1, $2, $3, null, $4, $5, $6)`,
        [clientId, coach.id, p.name, plan.payment.status, plan.payment.note, plan.payment.split],
      );
    }
  }

  const seriesId = randomUUID();
  await tx.query(
    `insert into recurring_series
       (id, coach_id, client_id, service_id, location_id, interval_weeks, start_date, end_date, timezone,
        payment_status, payment_note, split_ratio, notify_student, created_via, lesson_count, skipped_count)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      seriesId,
      coach.id,
      clientId,
      plan.serviceId,
      plan.preview.location.id,
      plan.rule.intervalWeeks,
      plan.rule.startDate,
      plan.rule.endDate,
      plan.preview.timezone,
      plan.payment.status,
      plan.payment.note,
      plan.payment.split,
      plan.preview.notifyStudent,
      createdVia,
      plan.create.length,
      plan.preview.skipCount,
    ],
  );
  const slotIds = plan.rule.slots.map(() => randomUUID());
  for (let i = 0; i < plan.rule.slots.length; i++) {
    const s = plan.rule.slots[i];
    await tx.query(
      `insert into recurring_slots (id, series_id, weekday, start_min, duration_min) values ($1,$2,$3,$4,$5)`,
      [slotIds[i], seriesId, s.weekday, s.startMin, s.durationMin],
    );
  }
  for (const occ of plan.create) {
    const lessonId = randomUUID();
    await tx.query(
      `insert into lessons
         (id, coach_id, service_id, location_id, client_id, start_at, end_at, status, source, series_id, slot_id, duration_min)
       values ($1,$2,$3,$4,$5,$6,$7,'confirmed','imported_recurring',$8,$9,$10)`,
      [
        lessonId,
        coach.id,
        plan.serviceId,
        plan.preview.location.id,
        clientId,
        occ.start!.toISOString(),
        occ.end!.toISOString(),
        seriesId,
        slotIds[occ.slotIndex],
        occ.durationMin,
      ],
    );
    await tx.query(
      `insert into payments (id, lesson_id, method, status, amount_cad) values ($1,$2,'offline','not_tracked',0)`,
      [randomUUID(), lessonId],
    );
  }

  return {
    ok: true,
    done: {
      seriesId,
      clientId,
      clientName: p.name,
      clientEmail: p.email,
      created: plan.create.length,
      skipped: plan.preview.skipCount,
      preview: plan.preview,
    },
  };
}

export type EndSeriesDone = {
  cancelled: number;
  fromDate: string;
  clientName: string;
  clientEmail: string | null;
  timezone: string;
};

/**
 * End a series from `fromDate` (coach's civil date, not before today):
 * confirmed lessons from then on are cancelled and their open requests closed.
 * Past lessons are left alone. The caller holds the transaction + lock.
 */
export async function endSeries(
  tx: QuerySql,
  coachId: string,
  seriesId: string,
  fromDate: string,
  now = new Date(),
): Promise<Result<{ done: EndSeriesDone }>> {
  const rows = await tx.query<{ status: string; timezone: string; client_name: string; client_email: string | null }>(
    `select s.status, s.timezone, cl.name as client_name, cl.email as client_email
     from recurring_series s join clients cl on cl.id = s.client_id
     where s.id = $1 and s.coach_id = $2`,
    [seriesId, coachId],
  );
  const series = rows[0];
  if (!series) return { ok: false, error: "Schedule not found." };
  if (series.status !== "active") return { ok: false, error: "This schedule has already ended." };
  const today = todayKey(series.timezone, now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || fromDate < today) {
    return { ok: false, error: "Pick today or a later date." };
  }
  const from = zonedInstant(fromDate, 0, series.timezone);
  const cutoff = from.getTime() > now.getTime() ? from : now;
  const cancelled = await tx.query<{ id: string }>(
    `update lessons set status = 'cancelled'
     where series_id = $1 and coach_id = $2 and status = 'confirmed' and start_at >= $3
     returning id`,
    [seriesId, coachId, cutoff.toISOString()],
  );
  const ids = cancelled.map((r) => r.id);
  if (ids.length) {
    await tx.query(
      `update booking_requests set status = 'cancelled', resolved_at = now()
       where coach_id = $1 and status = 'pending'
         and (lesson_id = any($2::text[]) or other_lesson_id = any($2::text[]))`,
      [coachId, ids],
    );
  }
  await tx.query(
    `update recurring_series set status = 'ended', ended_from = $1, ended_at = now() where id = $2 and coach_id = $3`,
    [fromDate, seriesId, coachId],
  );
  return {
    ok: true,
    done: {
      cancelled: ids.length,
      fromDate,
      clientName: series.client_name,
      clientEmail: series.client_email,
      timezone: series.timezone,
    },
  };
}
