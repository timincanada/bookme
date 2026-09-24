/**
 * Student sign-in by email code or magic link, and cookie sessions (database side).
 * The server-function layer (student-api.ts) handles cookies, request IP and mail.
 */
import { randomUUID } from "crypto";
import type { Sql } from "@/lib/db";
import { normalizeEmail, looksLikeEmail } from "./email";
import { makeCode, makeToken, STUDENT_SESSION_MS } from "./magic";
import {
  CODE_TTL_MS,
  hashSecret,
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_CODES_PER_IP_PER_HOUR,
  sameHash,
} from "./student-auth";

type QuerySql = Pick<Sql, "query">;

const HOUR_MS = 60 * 60 * 1000;

export type CodeRequest =
  | { issue: true; email: string; code: string; token: string }
  | { issue: false; reason: "invalid" | "unknown" | "rate_email" | "rate_ip" };

/**
 * Decide whether to issue a code. The caller answers the browser identically in
 * every case, so nothing reveals whether the email has bookings.
 */
export async function requestCode(sql: QuerySql, rawEmail: string, ip: string | null, now = new Date()): Promise<CodeRequest> {
  const email = normalizeEmail(rawEmail);
  if (!looksLikeEmail(email)) return { issue: false, reason: "invalid" };
  const since = new Date(now.getTime() - HOUR_MS).toISOString();
  const perEmail = await sql.query<{ n: number }>(
    `select count(*)::int as n from manage_links where lower(email) = $1 and created_at > $2`,
    [email, since],
  );
  if (Number(perEmail[0]?.n ?? 0) >= MAX_CODES_PER_EMAIL_PER_HOUR) return { issue: false, reason: "rate_email" };
  if (ip) {
    const perIp = await sql.query<{ n: number }>(
      `select count(*)::int as n from manage_links where request_ip = $1 and created_at > $2`,
      [ip, since],
    );
    if (Number(perIp[0]?.n ?? 0) >= MAX_CODES_PER_IP_PER_HOUR) return { issue: false, reason: "rate_ip" };
  }
  const known = await sql.query<{ id: string }>(`select id from clients where lower(trim(email)) = $1 limit 1`, [email]);
  if (!known[0]) return { issue: false, reason: "unknown" };

  await sql.query(`update manage_links set used_at = $2 where lower(email) = $1 and used_at is null`, [email, now.toISOString()]);
  const code = makeCode();
  const token = makeToken();
  await sql.query(
    `insert into manage_links (id, email, code_hash, token_hash, expires_at, request_ip, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      email,
      hashSecret("code", code),
      hashSecret("token", token),
      new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      ip,
      now.toISOString(),
    ],
  );
  return { issue: true, email, code, token };
}

export type VerifyResult = { ok: true; studentId: string; email: string } | { ok: false; error: string };

const INVALID = "That code is wrong or has expired. Request a new one.";

async function upsertStudent(sql: QuerySql, email: string, now: Date) {
  const rows = await sql.query<{ id: string }>(
    `insert into students (id, email, last_login_at) values ($1, $2, $3)
     on conflict ((lower(email))) do update set last_login_at = excluded.last_login_at
     returning id`,
    [randomUUID(), email, now.toISOString()],
  );
  return rows[0].id;
}

export async function verifyCode(sql: QuerySql, rawEmail: string, rawCode: string, now = new Date()): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode || "").trim();
  const link = (
    await sql.query<{ id: string; code_hash: string | null; attempts: number }>(
      `select id, code_hash, attempts from manage_links
       where lower(email) = $1 and used_at is null and expires_at > $2 and code_hash is not null
       order by created_at desc limit 1`,
      [email, now.toISOString()],
    )
  )[0];
  if (!link) return { ok: false, error: INVALID };
  if (!/^\d{6}$/.test(code) || !sameHash(link.code_hash, hashSecret("code", code))) {
    const attempts = Number(link.attempts) + 1;
    await sql.query(
      `update manage_links set attempts = $1::int, used_at = case when $1::int >= $2::int then $3::timestamptz else used_at end where id = $4`,
      [attempts, MAX_CODE_ATTEMPTS, now.toISOString(), link.id],
    );
    return { ok: false, error: INVALID };
  }
  const claimed = await sql.query<{ id: string }>(
    `update manage_links set used_at = $1 where id = $2 and used_at is null returning id`,
    [now.toISOString(), link.id],
  );
  if (!claimed[0]) return { ok: false, error: INVALID };
  return { ok: true, email, studentId: await upsertStudent(sql, email, now) };
}

export async function verifyToken(sql: QuerySql, rawToken: string, now = new Date()): Promise<VerifyResult> {
  const token = String(rawToken || "").trim();
  if (token.length < 16) return { ok: false, error: "That link is invalid or already used." };
  const claimed = await sql.query<{ email: string }>(
    `update manage_links set used_at = $1
     where token_hash = $2 and used_at is null and expires_at > $1
     returning email`,
    [now.toISOString(), hashSecret("token", token)],
  );
  if (!claimed[0]) return { ok: false, error: "That link is invalid or already used." };
  const email = normalizeEmail(claimed[0].email);
  return { ok: true, email, studentId: await upsertStudent(sql, email, now) };
}

export async function createSession(sql: QuerySql, studentId: string, email: string, now = new Date()) {
  const token = makeToken();
  const expires = new Date(now.getTime() + STUDENT_SESSION_MS);
  await sql.query(
    `insert into student_sessions (id, email, expires_at, token_hash, student_id, created_at, last_seen_at)
     values ($1, $2, $3, $4, $5, $6, $6)`,
    [randomUUID(), email, expires.toISOString(), hashSecret("session", token), studentId, now.toISOString()],
  );
  return { token, expires };
}

export type StudentIdentity = { studentId: string; email: string };

export async function sessionFromToken(sql: QuerySql, token: string | null | undefined, now = new Date()): Promise<StudentIdentity | null> {
  if (!token || token.length < 16) return null;
  const rows = await sql.query<{ id: string; student_id: string; email: string }>(
    `select ss.id, ss.student_id, st.email
     from student_sessions ss join students st on st.id = ss.student_id
     where ss.token_hash = $1 and ss.revoked_at is null and ss.expires_at > $2`,
    [hashSecret("session", token), now.toISOString()],
  );
  const row = rows[0];
  if (!row) return null;
  await sql.query(`update student_sessions set last_seen_at = $1 where id = $2`, [now.toISOString(), row.id]);
  return { studentId: row.student_id, email: normalizeEmail(row.email) };
}

export async function revokeSession(sql: QuerySql, token: string | null | undefined, now = new Date()) {
  if (!token) return;
  await sql.query(`update student_sessions set revoked_at = $1 where token_hash = $2 and revoked_at is null`, [
    now.toISOString(),
    hashSecret("session", token),
  ]);
}
