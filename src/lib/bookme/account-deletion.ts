/**
 * Account deletion (database side).
 *
 * Coach: blocked while upcoming lessons exist; otherwise deactivated and
 * anonymized at once (profile, sign-in, devices), then purged after 30 days
 * (auth user removed, their clients' personal data cleared). Lesson and payment
 * rows are kept without personal data.
 *
 * Student: login identity, sessions, devices, codes and conversations are
 * removed; coaches keep their lesson history with the client shown as
 * "Deleted student" (name/email/phone cleared).
 */
import { randomUUID } from "crypto";
import type { Sql } from "@/lib/db";
import { normalizeEmail } from "./email";

type QuerySql = Pick<Sql, "query">;

export const COACH_PURGE_DAYS = 30;
export const DELETED_COACH_NAME = "Deleted coach";
export const DELETED_STUDENT_NAME = "Deleted student";
export const FORMER_CLIENT_NAME = "Former client";

export type CoachDeletionCheck =
  | { ok: true; stripeAccountId: string | null; stripeSubscriptionId: string | null; userId: string | null }
  | { ok: false; error: string };

export async function checkCoachDeletion(sql: QuerySql, coachId: string, now = new Date()): Promise<CoachDeletionCheck> {
  const coach = (
    await sql.query<{ user_id: string | null; stripe_account_id: string | null; stripe_subscription_id: string | null; deleted_at: string | null }>(
      `select user_id, stripe_account_id, stripe_subscription_id, deleted_at from coaches where id = $1`,
      [coachId],
    )
  )[0];
  if (!coach) return { ok: false, error: "Account not found." };
  if (coach.deleted_at) return { ok: false, error: "This account is already deleted." };
  const upcoming = await sql.query<{ n: number }>(
    `select count(*)::int as n from lessons
     where coach_id = $1 and status in ('confirmed', 'held') and end_at > $2`,
    [coachId, now.toISOString()],
  );
  const n = Number(upcoming[0]?.n ?? 0);
  if (n > 0) {
    return {
      ok: false,
      error: `You have ${n} upcoming lesson${n === 1 ? "" : "s"}. Cancel or finish ${n === 1 ? "it" : "them"} before deleting your account.`,
    };
  }
  return {
    ok: true,
    stripeAccountId: coach.stripe_account_id,
    stripeSubscriptionId: coach.stripe_subscription_id,
    userId: coach.user_id,
  };
}

export async function deactivateCoach(tx: QuerySql, coachId: string, now = new Date()) {
  const check = await checkCoachDeletion(tx, coachId, now);
  if (!check.ok) return check;
  const purgeAfter = new Date(now.getTime() + COACH_PURGE_DAYS * 86_400_000);
  const placeholder = `deleted-${coachId}@deleted.invalid`;
  await tx.query(
    `update coaches set
       deleted_at = $2, purge_after = $3,
       name = $4, email = $5, slug = $6, title = '', city = '', headline = '', bio = '', notes = '',
       photo_url = null, assistant_name = default,
       stripe_account_id = null, stripe_subscription_id = null,
       subscription_status = 'canceled', plan = 'none', trial_ends_at = null,
       accept_card = false, accept_cash = false
     where id = $1`,
    [coachId, now.toISOString(), purgeAfter.toISOString(), DELETED_COACH_NAME, placeholder, `deleted-${coachId}`],
  );
  await tx.query(`update locations set address = '' where coach_id = $1`, [coachId]);
  await tx.query(`delete from device_tokens where coach_id = $1`, [coachId]);
  if (check.userId) {
    await tx.query(`delete from "session" where "userId" = $1`, [check.userId]);
    await tx.query(`delete from "account" where "userId" = $1`, [check.userId]);
    await tx.query(`update "user" set email = $2, name = $3, image = null where id = $1`, [
      check.userId,
      placeholder,
      DELETED_COACH_NAME,
    ]);
  }
  await tx.query(
    `insert into account_deletions (id, kind, subject_id, requested_at, purge_after) values ($1, 'coach', $2, $3, $4)`,
    [randomUUID(), coachId, now.toISOString(), purgeAfter.toISOString()],
  );
  return { ok: true as const, purgeAfter };
}

/** Run daily: hard-delete coach sign-in accounts 30 days after deletion. */
export async function purgeDeletedCoaches(sql: QuerySql, now = new Date()) {
  const due = await sql.query<{ id: string; user_id: string | null }>(
    `select id, user_id from coaches where deleted_at is not null and purged_at is null and purge_after <= $1`,
    [now.toISOString()],
  );
  for (const c of due) {
    await sql.query(`delete from conversations where coach_id = $1`, [c.id]);
    await sql.query(
      `update clients set name = $2, email = null, phone = null, note = '',
         payment_status = null, payment_note = '', split_ratio = ''
       where coach_id = $1`,
      [c.id, FORMER_CLIENT_NAME],
    );
    await sql.query(`update recurring_series set payment_status = null, payment_note = '', split_ratio = '' where coach_id = $1`, [c.id]);
    await sql.query(`update booking_requests set note = '' where coach_id = $1`, [c.id]);
    await sql.query(`update coaches set user_id = null, purged_at = $2 where id = $1`, [c.id, now.toISOString()]);
    if (c.user_id) await sql.query(`delete from "user" where id = $1`, [c.user_id]);
    await sql.query(`update account_deletions set purged_at = $2 where kind = 'coach' and subject_id = $1 and purged_at is null`, [
      c.id,
      now.toISOString(),
    ]);
  }
  return { purged: due.length };
}

export async function deleteStudent(tx: QuerySql, studentId: string, now = new Date()) {
  const student = (await tx.query<{ email: string }>(`select email from students where id = $1`, [studentId]))[0];
  if (!student) return { ok: false as const, error: "Account not found." };
  const email = normalizeEmail(student.email);
  const clientIds = (
    await tx.query<{ id: string }>(`select id from clients where lower(email) = $1`, [email])
  ).map((r) => r.id);
  if (clientIds.length) {
    await tx.query(`delete from conversations where client_id = any($1::text[])`, [clientIds]);
    await tx.query(
      `update clients set name = $2, email = null, phone = null where id = any($1::text[])`,
      [clientIds, DELETED_STUDENT_NAME],
    );
  }
  await tx.query(`delete from manage_links where lower(email) = $1`, [email]);
  await tx.query(`delete from student_sessions where student_id = $1 or lower(email) = $2`, [studentId, email]);
  await tx.query(`delete from students where id = $1`, [studentId]);
  await tx.query(
    `insert into account_deletions (id, kind, subject_id, requested_at, purged_at) values ($1, 'student', $2, $3, $3)`,
    [randomUUID(), studentId, now.toISOString()],
  );
  return { ok: true as const, clients: clientIds.length };
}
