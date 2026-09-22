/**
 * Operations console — database side.
 *
 * Privacy: coaches are shown in full (they are the customers); students are
 * never named. Only the audited email lookup resolves one student's bookings,
 * and even then it returns lessons, not notes or messages.
 */
import { randomUUID } from "crypto";
import type { Sql } from "@/lib/db";
import {
  cleanRange,
  platformFeeCad,
  recentMonths,
  REPORT_TIMEZONE,
  studentLabel,
  type AdminRole,
  type PeriodKey,
  periodRange,
} from "./admin-console";
import { normalizeEmail } from "./email";
import { addDaysKey, todayKey, zonedInstant } from "./time";

type QuerySql = Pick<Sql, "query">;

const TZ = REPORT_TIMEZONE;
const num = (v: unknown) => Number(v ?? 0);

/** Civil date range → absolute instants (end is exclusive, next midnight). */
function bounds(from: string, to: string) {
  return [zonedInstant(from, 0, TZ).toISOString(), zonedInstant(addDaysKey(to, 1), 0, TZ).toISOString()];
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

export type AdminIdentity = { email: string; role: AdminRole };

/** Signed-in user → console role, or null. Requires a verified email. */
export async function adminIdentity(
  sql: QuerySql,
  user: { email?: string | null; emailVerified?: boolean | null } | null | undefined,
): Promise<AdminIdentity | null> {
  if (!user?.email || user.emailVerified !== true) return null;
  const email = normalizeEmail(user.email);
  const rows = await sql.query<{ role: string }>(`select role from staff where lower(email) = $1`, [email]);
  const role = rows[0]?.role;
  return role === "owner" || role === "admin" ? { email, role } : null;
}

export async function listTeam(sql: QuerySql) {
  return sql.query<{ id: string; email: string; role: string; added_by: string | null; created_at: string | Date }>(
    `select id, email, role, added_by, created_at from staff order by role, email`,
  );
}

export async function addTeamMember(sql: QuerySql, email: string, addedBy: string) {
  const clean = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false as const, error: "Enter a valid email." };
  await sql.query(
    `insert into staff (id, email, role, added_by) values ($1, $2, 'admin', $3)
     on conflict (email) do nothing`,
    [randomUUID(), clean, addedBy],
  );
  return { ok: true as const, email: clean };
}

export async function removeTeamMember(sql: QuerySql, email: string) {
  const clean = normalizeEmail(email);
  const rows = await sql.query<{ id: string }>(
    `delete from staff where lower(email) = $1 and role <> 'owner' returning id`,
    [clean],
  );
  if (!rows[0]) return { ok: false as const, error: "Not found, or the owner can't be removed." };
  return { ok: true as const, email: clean };
}

export async function recordAction(
  sql: QuerySql,
  actor: AdminIdentity,
  input: { kind: string; subjectType: string; subjectId: string; detail?: string; note?: string },
) {
  await sql.query(
    `insert into admin_actions (id, actor_email, actor_role, kind, subject_type, subject_id, detail, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      randomUUID(),
      actor.email,
      actor.role,
      input.kind,
      input.subjectType,
      input.subjectId,
      String(input.detail || "").slice(0, 500),
      String(input.note || "").slice(0, 500),
    ],
  );
}

export async function recentActions(sql: QuerySql, limit = 50, subject?: { type: string; id: string }) {
  // created_at often ties (now() is the transaction timestamp). seq is insert
  // order; id is a random uuid and cannot break the tie.
  if (subject) {
    return sql.query<ActionRow>(
      `select id, actor_email, actor_role, kind, subject_type, subject_id, detail, note, created_at
       from admin_actions where subject_type = $1 and subject_id = $2
       order by created_at desc, seq desc limit $3`,
      [subject.type, subject.id, limit],
    );
  }
  return sql.query<ActionRow>(
    `select id, actor_email, actor_role, kind, subject_type, subject_id, detail, note, created_at
     from admin_actions order by created_at desc, seq desc limit $1`,
    [limit],
  );
}

export type ActionRow = {
  id: string;
  actor_email: string;
  actor_role: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  detail: string;
  note: string;
  created_at: string | Date;
};

// Staff members' own coach rows never count as customers.
const REAL_COACHES = `c.deleted_at is null and lower(c.email) not in (select lower(email) from staff)`;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export async function summary(sql: QuerySql, period: PeriodKey, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const [start, end] = bounds(from, to);
  const coaches = (
    await sql.query<{ total: number; trialing: number; active: number; banned: number; connected: number }>(
      `select
         count(*)::int as total,
         count(*) filter (where c.banned = false and c.subscription_status = 'trialing' and (c.trial_ends_at is null or c.trial_ends_at > now()))::int as trialing,
         count(*) filter (where c.banned = false and c.subscription_status = 'active')::int as active,
         count(*) filter (where c.banned)::int as banned,
         count(*) filter (where c.stripe_account_id is not null)::int as connected
       from coaches c where ${REAL_COACHES}`,
    )
  )[0];

  const lessons = (
    await sql.query<{ booked: number; confirmed: number; cancelled: number; imported: number; coaches_active: number }>(
      `select
         count(*)::int as booked,
         count(*) filter (where l.status in ('confirmed','completed'))::int as confirmed,
         count(*) filter (where l.status = 'cancelled')::int as cancelled,
         count(*) filter (where l.source = 'imported_recurring')::int as imported,
         count(distinct l.coach_id)::int as coaches_active
       from lessons l join coaches c on c.id = l.coach_id
       where ${REAL_COACHES} and l.start_at >= $1 and l.start_at < $2`,
      [start, end],
    )
  )[0];

  const money = (
    await sql.query<{ card_paid: number; cash_collected: number; refunded: number; card_count: number; refund_count: number }>(
      `select
         coalesce(sum(p.amount_cad) filter (where p.method = 'card' and p.status = 'paid'), 0)::float as card_paid,
         coalesce(sum(p.amount_cad) filter (where p.status = 'marked_offline'), 0)::float as cash_collected,
         coalesce(sum(p.amount_cad) filter (where p.status = 'refunded'), 0)::float as refunded,
         count(*) filter (where p.method = 'card' and p.status = 'paid')::int as card_count,
         count(*) filter (where p.status = 'refunded')::int as refund_count
       from payments p join lessons l on l.id = p.lesson_id join coaches c on c.id = l.coach_id
       where ${REAL_COACHES} and l.start_at >= $1 and l.start_at < $2`,
      [start, end],
    )
  )[0];

  const plans = await sql.query<{ plan: string; n: number }>(
    `select c.plan, count(*)::int as n from coaches c
     where ${REAL_COACHES} and c.banned = false and c.subscription_status = 'active'
     group by c.plan order by c.plan`,
  );

  const today = todayKey(TZ, now);
  const attention = (
    await sql.query<Record<string, number>>(
      `select
        (select count(*) from coaches c where ${REAL_COACHES} and c.banned = false
           and c.subscription_status = 'trialing' and c.trial_ends_at is not null
           and c.trial_ends_at between now() and now() + interval '3 days')::int as "trialEndingSoon",
        (select count(distinct c.id) from coaches c join lessons l on l.coach_id = c.id
           where ${REAL_COACHES} and c.subscription_status in ('past_due','canceled','unpaid')
             and l.status = 'confirmed' and l.start_at > now())::int as "pastDue",
        (select count(*) from coaches c where ${REAL_COACHES} and c.accept_card and c.stripe_account_id is null)::int as "cardWithoutStripe",
        (select count(*) from lessons where status = 'held' and hold_until < now() - interval '1 day')::int as "stuckHolds",
        (select count(*) from lessons l left join payments p on p.lesson_id = l.id
           where l.status = 'confirmed' and p.id is null)::int as "lessonsWithoutPayment",
        (select count(*) from coaches where deleted_at is not null and purged_at is null)::int as "pendingPurge"`,
    )
  )[0];

  return {
    period,
    from,
    to,
    today,
    coaches: {
      total: num(coaches.total),
      trialing: num(coaches.trialing),
      active: num(coaches.active),
      banned: num(coaches.banned),
      connected: num(coaches.connected),
    },
    lessons: {
      booked: num(lessons.booked),
      confirmed: num(lessons.confirmed),
      cancelled: num(lessons.cancelled),
      imported: num(lessons.imported),
      coachesActive: num(lessons.coaches_active),
    },
    money: {
      cardPaid: num(money.card_paid),
      cashCollected: num(money.cash_collected),
      refunded: num(money.refunded),
      platformFee: platformFeeCad(num(money.card_paid)),
      cardCount: num(money.card_count),
      refundCount: num(money.refund_count),
    },
    plans: plans.map((p) => ({ plan: p.plan || "none", count: num(p.n) })),
    attention: Object.fromEntries(Object.entries(attention).map(([k, v]) => [k, num(v)])),
  };
}

// ---------------------------------------------------------------------------
// Coaches
// ---------------------------------------------------------------------------

export type CoachSort = "recent" | "lessons" | "revenue" | "name";

export async function listCoaches(
  sql: QuerySql,
  opts: { search?: string; status?: string; sort?: CoachSort; limit?: number; offset?: number } = {},
) {
  const search = String(opts.search || "").trim().toLowerCase();
  const status = String(opts.status || "all");
  const sort: CoachSort = (["recent", "lessons", "revenue", "name"] as const).includes(opts.sort as CoachSort)
    ? (opts.sort as CoachSort)
    : "recent";
  const limit = Math.min(200, Math.max(10, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const order = {
    recent: "last_lesson_at desc nulls last, c.created_at desc",
    lessons: "lessons_confirmed desc",
    revenue: "card_paid desc",
    name: "c.name asc",
  }[sort];
  const statusSql = {
    all: "true",
    trialing: "c.banned = false and c.subscription_status = 'trialing'",
    active: "c.banned = false and c.subscription_status = 'active'",
    lapsed: "c.banned = false and c.subscription_status in ('past_due','canceled','unpaid','none')",
    banned: "c.banned",
  }[status as "all"] ?? "true";

  const rows = await sql.query<{
    id: string;
    name: string;
    email: string;
    slug: string;
    city: string;
    plan: string;
    subscription_status: string;
    trial_ends_at: string | Date | null;
    banned: boolean;
    access_grant: string | null;
    stripe_account_id: string | null;
    created_at: string | Date;
    lessons_confirmed: number;
    lessons_upcoming: number;
    clients: number;
    card_paid: number;
    cash_collected: number;
    last_lesson_at: string | Date | null;
    total: number;
  }>(
    `with base as (
       select c.* from coaches c where ${REAL_COACHES} and ${statusSql}
         and ($1 = '' or lower(c.name) like '%' || $1 || '%' or lower(c.email) like '%' || $1 || '%' or lower(c.slug) like '%' || $1 || '%')
     )
     select c.id, c.name, c.email, c.slug, c.city, c.plan, c.subscription_status, c.trial_ends_at, c.banned,
            c.access_grant, c.stripe_account_id, c.created_at,
            coalesce(l.confirmed, 0)::int as lessons_confirmed,
            coalesce(l.upcoming, 0)::int as lessons_upcoming,
            coalesce(cl.n, 0)::int as clients,
            coalesce(m.card_paid, 0)::float as card_paid,
            coalesce(m.cash_collected, 0)::float as cash_collected,
            l.last_lesson_at,
            count(*) over ()::int as total
     from base c
     left join (
       select coach_id,
              count(*) filter (where status in ('confirmed','completed')) as confirmed,
              count(*) filter (where status = 'confirmed' and start_at > now()) as upcoming,
              max(start_at) as last_lesson_at
       from lessons group by coach_id
     ) l on l.coach_id = c.id
     left join (select coach_id, count(*) as n from clients group by coach_id) cl on cl.coach_id = c.id
     left join (
       select l2.coach_id,
              sum(p.amount_cad) filter (where p.method = 'card' and p.status = 'paid') as card_paid,
              sum(p.amount_cad) filter (where p.status = 'marked_offline') as cash_collected
       from payments p join lessons l2 on l2.id = p.lesson_id group by l2.coach_id
     ) m on m.coach_id = c.id
     order by ${order}
     limit $2 offset $3`,
    [search, limit, offset],
  );

  return {
    total: rows[0] ? num(rows[0].total) : 0,
    limit,
    offset,
    coaches: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      slug: r.slug,
      city: r.city,
      plan: r.plan,
      status: r.subscription_status,
      trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at).toISOString() : null,
      banned: r.banned === true || String(r.banned) === "t",
      accessGrant: r.access_grant || "",
      stripeConnected: Boolean(r.stripe_account_id),
      createdAt: new Date(r.created_at).toISOString(),
      lessonsConfirmed: num(r.lessons_confirmed),
      lessonsUpcoming: num(r.lessons_upcoming),
      clients: num(r.clients),
      cardPaid: num(r.card_paid),
      cashCollected: num(r.cash_collected),
      platformFee: platformFeeCad(num(r.card_paid)),
      lastLessonAt: r.last_lesson_at ? new Date(r.last_lesson_at).toISOString() : null,
    })),
  };
}

export async function coachDetail(sql: QuerySql, coachId: string) {
  const coach = (
    await sql.query<Record<string, unknown>>(
      `select c.id, c.name, c.email, c.slug, c.city, c.timezone, c.plan, c.subscription_status, c.trial_ends_at,
              c.banned, c.access_grant, c.stripe_account_id, c.stripe_subscription_id, c.accept_card, c.accept_cash,
              c.created_at, c.deleted_at, c.purge_after
       from coaches c where c.id = $1`,
      [coachId],
    )
  )[0];
  if (!coach) return null;

  const lessons = (
    await sql.query<Record<string, number>>(
      `select
         count(*) filter (where status in ('confirmed','completed'))::int as confirmed,
         count(*) filter (where status = 'cancelled')::int as cancelled,
         count(*) filter (where status = 'confirmed' and start_at > now())::int as upcoming,
         count(*) filter (where source = 'imported_recurring')::int as imported,
         count(*) filter (where start_at > now() - interval '30 days' and start_at <= now() and status in ('confirmed','completed'))::int as last30
       from lessons where coach_id = $1`,
      [coachId],
    )
  )[0];

  const money = await sql.query<{ month: string; card_paid: number; cash: number; refunded: number; n: number }>(
    `select to_char(l.start_at at time zone $2, 'YYYY-MM') as month,
            coalesce(sum(p.amount_cad) filter (where p.method = 'card' and p.status = 'paid'), 0)::float as card_paid,
            coalesce(sum(p.amount_cad) filter (where p.status = 'marked_offline'), 0)::float as cash,
            coalesce(sum(p.amount_cad) filter (where p.status = 'refunded'), 0)::float as refunded,
            count(*)::int as n
     from payments p join lessons l on l.id = p.lesson_id
     where l.coach_id = $1 group by 1 order by 1 desc limit 12`,
    [coachId, TZ],
  );

  const clients = (await sql.query<{ n: number; with_email: number }>(
    `select count(*)::int as n, count(*) filter (where email is not null)::int as with_email from clients where coach_id = $1`,
    [coachId],
  ))[0];

  const series = (await sql.query<{ n: number }>(
    `select count(*)::int as n from recurring_series where coach_id = $1 and status = 'active'`,
    [coachId],
  ))[0];

  return {
    coach: {
      id: String(coach.id),
      name: String(coach.name),
      email: String(coach.email),
      slug: String(coach.slug),
      city: String(coach.city ?? ""),
      timezone: String(coach.timezone ?? TZ),
      plan: String(coach.plan ?? ""),
      status: String(coach.subscription_status ?? ""),
      trialEndsAt: coach.trial_ends_at ? new Date(coach.trial_ends_at as string).toISOString() : null,
      banned: coach.banned === true || coach.banned === "t",
      accessGrant: String(coach.access_grant ?? ""),
      stripeConnected: Boolean(coach.stripe_account_id),
      subscribed: Boolean(coach.stripe_subscription_id),
      acceptCard: coach.accept_card === true || coach.accept_card === "t",
      acceptCash: coach.accept_cash === true || coach.accept_cash === "t",
      createdAt: new Date(coach.created_at as string).toISOString(),
      deletedAt: coach.deleted_at ? new Date(coach.deleted_at as string).toISOString() : null,
    },
    lessons: {
      confirmed: num(lessons.confirmed),
      cancelled: num(lessons.cancelled),
      upcoming: num(lessons.upcoming),
      imported: num(lessons.imported),
      last30: num(lessons.last30),
    },
    clients: { total: num(clients.n), withEmail: num(clients.with_email) },
    activeSeries: num(series.n),
    months: money.map((m) => ({
      month: m.month,
      cardPaid: num(m.card_paid),
      cash: num(m.cash),
      refunded: num(m.refunded),
      platformFee: platformFeeCad(num(m.card_paid)),
      payments: num(m.n),
    })),
  };
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

export async function revenue(sql: QuerySql, months = 12, now = new Date()) {
  const keys = recentMonths(months, now);
  const rows = await sql.query<{ month: string; card_paid: number; cash: number; refunded: number; card_count: number; refund_count: number }>(
    `select to_char(l.start_at at time zone $2, 'YYYY-MM') as month,
            coalesce(sum(p.amount_cad) filter (where p.method = 'card' and p.status = 'paid'), 0)::float as card_paid,
            coalesce(sum(p.amount_cad) filter (where p.status = 'marked_offline'), 0)::float as cash,
            coalesce(sum(p.amount_cad) filter (where p.status = 'refunded'), 0)::float as refunded,
            count(*) filter (where p.method = 'card' and p.status = 'paid')::int as card_count,
            count(*) filter (where p.status = 'refunded')::int as refund_count
     from payments p join lessons l on l.id = p.lesson_id join coaches c on c.id = l.coach_id
     where ${REAL_COACHES} and to_char(l.start_at at time zone $2, 'YYYY-MM') = any($1::text[])
     group by 1`,
    [keys, TZ],
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return keys.map((month) => {
    const r = byMonth.get(month);
    const cardPaid = num(r?.card_paid);
    return {
      month,
      cardPaid,
      cash: num(r?.cash),
      refunded: num(r?.refunded),
      platformFee: platformFeeCad(cardPaid),
      coachShare: Math.round((cardPaid - platformFeeCad(cardPaid)) * 100) / 100,
      cardCount: num(r?.card_count),
      refundCount: num(r?.refund_count),
    };
  });
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function lessonsReport(
  sql: QuerySql,
  opts: { from?: string; to?: string; coachId?: string; status?: string; limit?: number } = {},
  now = new Date(),
) {
  const range = cleanRange(opts.from, opts.to, now);
  const [start, end] = bounds(range.from, range.to);
  const limit = Math.min(500, Math.max(20, Number(opts.limit) || 200));
  const coachId = String(opts.coachId || "");
  const status = String(opts.status || "all");
  const rows = await sql.query<{
    id: string;
    start_at: string | Date;
    status: string;
    source: string;
    coach_id: string;
    coach_name: string;
    pay_method: string | null;
    pay_status: string | null;
    amount_cad: number | null;
  }>(
    `select l.id, l.start_at, l.status, l.source, l.coach_id, c.name as coach_name,
            p.method as pay_method, p.status as pay_status, p.amount_cad
     from lessons l join coaches c on c.id = l.coach_id
     left join payments p on p.lesson_id = l.id
     where ${REAL_COACHES} and l.start_at >= $1 and l.start_at < $2
       and ($3 = '' or l.coach_id = $3)
       and ($4 = 'all' or l.status = $4)
     order by l.start_at desc limit $5`,
    [start, end, coachId, status, limit],
  );

  const anomalies = (
    await sql.query<Record<string, number>>(
      `select
        (select count(*) from lessons where status = 'held' and hold_until < now() - interval '1 day')::int as "stuckHolds",
        (select count(*) from lessons l left join payments p on p.lesson_id = l.id where l.status = 'confirmed' and p.id is null)::int as "missingPayment",
        (select count(*) from lessons l join payments p on p.lesson_id = l.id where l.status = 'cancelled' and p.status = 'paid')::int as "paidButCancelled",
        (select count(*) from lessons l join payments p on p.lesson_id = l.id where l.status = 'confirmed' and p.status = 'refunded')::int as "refundedButConfirmed"`,
    )
  )[0];

  return {
    range,
    lessons: rows.map((r, i) => ({
      id: r.id,
      startAt: new Date(r.start_at).toISOString(),
      status: r.status,
      source: r.source,
      coachId: r.coach_id,
      coachName: r.coach_name,
      student: studentLabel(i + 1),
      payMethod: r.pay_method || "",
      payStatus: r.pay_status || "",
      amountCad: num(r.amount_cad),
    })),
    anomalies: Object.fromEntries(Object.entries(anomalies).map(([k, v]) => [k, num(v)])),
  };
}

// ---------------------------------------------------------------------------
// Student lookup (audited; support only)
// ---------------------------------------------------------------------------

export async function lookupStudent(sql: QuerySql, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, error: "Enter a valid email." };
  const rows = await sql.query<{
    lesson_id: string;
    start_at: string | Date;
    status: string;
    coach_name: string;
    coach_id: string;
    pay_status: string | null;
    pay_method: string | null;
    amount_cad: number | null;
  }>(
    `select l.id as lesson_id, l.start_at, l.status, c.name as coach_name, c.id as coach_id,
            p.status as pay_status, p.method as pay_method, p.amount_cad
     from clients cl join lessons l on l.client_id = cl.id join coaches c on c.id = l.coach_id
     left join payments p on p.lesson_id = l.id
     where lower(cl.email) = $1
     order by l.start_at desc limit 100`,
    [email],
  );
  const account = (
    await sql.query<{ id: string; created_at: string | Date; last_login_at: string | Date | null }>(
      `select id, created_at, last_login_at from students where lower(email) = $1`,
      [email],
    )
  )[0];
  return {
    ok: true as const,
    email,
    hasPortalAccount: Boolean(account),
    lastLoginAt: account?.last_login_at ? new Date(account.last_login_at).toISOString() : null,
    lessons: rows.map((r) => ({
      id: r.lesson_id,
      startAt: new Date(r.start_at).toISOString(),
      status: r.status,
      coachId: r.coach_id,
      coachName: r.coach_name,
      payStatus: r.pay_status || "",
      payMethod: r.pay_method || "",
      amountCad: num(r.amount_cad),
    })),
  };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function health(sql: QuerySql, now = new Date()) {
  const jobs = await sql.query<{ job: string; ran_at: string | Date; ok: boolean; detail: string }>(
    `select distinct on (job) job, ran_at, ok, detail from job_runs order by job, ran_at desc`,
  );
  const counts = (
    await sql.query<Record<string, number>>(
      `select
        (select count(*) from coaches where deleted_at is not null and purged_at is null)::int as "pendingPurge",
        (select count(*) from lessons where status = 'held' and hold_until < now() - interval '1 day')::int as "stuckHolds",
        (select count(*) from lessons l join clients cl on cl.id = l.client_id
          where l.status = 'confirmed' and l.start_at between now() and now() + interval '24 hours'
            and l.reminded_24h = false and cl.email is not null)::int as "remindersDue",
        (select count(*) from clients where email is null)::int as "clientsWithoutEmail",
        (select count(*) from device_tokens)::int as "devices",
        (select count(*) from students)::int as "studentAccounts",
        (select count(*) from conversations)::int as "conversations"`,
    )
  )[0];
  return {
    now: now.toISOString(),
    jobs: jobs.map((j) => ({
      job: j.job,
      ranAt: new Date(j.ran_at).toISOString(),
      ok: j.ok === true || String(j.ok) === "t",
      detail: j.detail,
    })),
    counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, num(v)])),
  };
}

export async function recordJobRun(sql: QuerySql, job: string, ok: boolean, detail: string) {
  await sql.query(`insert into job_runs (id, job, ok, detail) values ($1, $2, $3, $4)`, [
    randomUUID(),
    job,
    ok,
    String(detail || "").slice(0, 500),
  ]);
}

// ---------------------------------------------------------------------------
// Actions on coaches
// ---------------------------------------------------------------------------

export async function setAccessGrant(sql: QuerySql, coachId: string, grant: string) {
  if (!["", "paid", "unpaid"].includes(grant)) return { ok: false as const, error: "Unknown grant" };
  const rows = await sql.query<{ id: string }>(
    `update coaches set access_grant = $1 where id = $2 and deleted_at is null returning id`,
    [grant, coachId],
  );
  return rows[0] ? { ok: true as const } : { ok: false as const, error: "Coach not found" };
}

export async function setBanned(sql: QuerySql, coachId: string, banned: boolean) {
  const rows = await sql.query<{ id: string; email: string }>(
    `update coaches set banned = $1 where id = $2 and deleted_at is null
       and lower(email) not in (select lower(email) from staff)
     returning id, email`,
    [banned, coachId],
  );
  return rows[0] ? { ok: true as const } : { ok: false as const, error: "Coach not found (staff can't be banned)" };
}

export async function extendTrial(sql: QuerySql, coachId: string, days: number, now = new Date()) {
  const add = Math.max(1, Math.min(90, Math.floor(days)));
  const rows = await sql.query<{ trial_ends_at: string | Date }>(
    `update coaches
       set trial_ends_at = greatest(coalesce(trial_ends_at, $2::timestamptz), $2::timestamptz) + make_interval(days => $3),
           subscription_status = case when subscription_status in ('active') then subscription_status else 'trialing' end
     where id = $1 and deleted_at is null
     returning trial_ends_at`,
    [coachId, now.toISOString(), add],
  );
  if (!rows[0]) return { ok: false as const, error: "Coach not found" };
  return { ok: true as const, days: add, trialEndsAt: new Date(rows[0].trial_ends_at).toISOString() };
}
