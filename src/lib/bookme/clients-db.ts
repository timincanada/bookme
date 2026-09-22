import type { Sql } from "@/lib/db";

/**
 * Coach-scoped CRM access. Every query here is keyed by coach_id: a student
 * (one email) may have a separate `clients` row under each coach they book,
 * and one coach's row is never read or written through another coach.
 */

type QuerySql = Pick<Sql, "query">;

export type CoachClient = { id: string; name: string; email: string; note: string };

/**
 * Public (signed-out) booking: find this coach's record for the email or create
 * it. An existing record keeps its name and note; the phone is only filled when
 * the record has none. Other coaches' records for the same email are untouched.
 * New records store the email in lower case.
 */
export async function findOrCreateCoachClient(
  sql: QuerySql,
  coachId: string,
  input: { id: string; name: string; email: string; phone?: string | null },
) {
  const phone = input.phone?.trim() || null;
  const email = input.email.trim().toLowerCase();
  const inserted = await sql.query<{ id: string }>(
    `insert into clients (id, coach_id, name, email, phone)
     values ($1, $2, $3, $4, $5)
     on conflict (coach_id, (lower(email))) do nothing
     returning id`,
    [input.id, coachId, input.name, email, phone],
  );
  if (inserted[0]) return { id: inserted[0].id, created: true as const };

  const existing = await sql.query<{ id: string }>(
    `select id from clients where coach_id = $1 and lower(email) = lower($2) limit 1`,
    [coachId, email],
  );
  const id = existing[0]?.id;
  if (!id) throw new Error("client upsert found no row");
  if (phone) {
    await sql.query(
      `update clients set phone = $1
       where id = $2 and coach_id = $3 and (phone is null or phone = '')`,
      [phone, id, coachId],
    );
  }
  return { id, created: false as const };
}

export async function listCoachClients(sql: QuerySql, coachId: string) {
  return sql.query<CoachClient & { n: number }>(
    `select cl.id, cl.name, cl.email, cl.note, count(l.id)::int as n
     from clients cl
     left join lessons l on l.client_id = cl.id and l.coach_id = cl.coach_id
     where cl.coach_id = $1
     group by cl.id, cl.name, cl.email, cl.note
     order by cl.name`,
    [coachId],
  );
}

export async function getCoachClient(sql: QuerySql, coachId: string, clientId: string) {
  const rows = await sql.query<CoachClient>(
    `select id, name, email, note from clients where id = $1 and coach_id = $2`,
    [clientId, coachId],
  );
  return rows[0] ?? null;
}

/** Returns false when the client is not this coach's. */
export async function saveCoachClientNote(sql: QuerySql, coachId: string, clientId: string, note: string) {
  const rows = await sql.query<{ id: string }>(
    `update clients set note = $1 where id = $2 and coach_id = $3 returning id`,
    [note, clientId, coachId],
  );
  return rows.length > 0;
}

export async function listCoachClientNames(sql: QuerySql, coachId: string) {
  return sql.query<{ id: string; name: string }>(
    `select id, name from clients where coach_id = $1 order by name`,
    [coachId],
  );
}
