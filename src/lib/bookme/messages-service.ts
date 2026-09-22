/**
 * Coach ↔ student messaging — database side. All access is scoped:
 * coaches only reach their own client records; students only reach client
 * records that carry their (verified) email.
 */
import { randomUUID } from "crypto";
import type { Sql } from "@/lib/db";
import { normalizeEmail } from "./email";
import {
  cleanBody,
  messageMode,
  MESSAGES_PER_MINUTE,
  shouldNotify,
  type MessageMode,
  type ModeReason,
} from "./messages";
import { canAcceptNewBookings } from "./subscription";

type QuerySql = Pick<Sql, "query">;

function asDate(v: string | Date | null | undefined) {
  return v ? (v instanceof Date ? v : new Date(v)) : null;
}

export type CoachFlags = {
  banned: boolean | string;
  access_grant: string | null;
  subscription_status: string | null;
  trial_ends_at: string | Date | null;
};

export function coachIsActive(c: CoachFlags) {
  const banned = c.banned === true || c.banned === "t" || c.banned === "true";
  if (banned) return false;
  if (c.access_grant === "unpaid") return false;
  if (c.access_grant === "paid") return true;
  return canAcceptNewBookings(c.subscription_status, asDate(c.trial_ends_at));
}

const COACH_FLAG_COLUMNS = "c.banned, c.access_grant, c.subscription_status, c.trial_ends_at";

type ThreadRow = CoachFlags & {
  coach_id: string;
  coach_name: string;
  coach_email: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  conversation_id: string | null;
  last_valid_end: string | Date | null;
  last_message_at: string | Date | null;
  coach_last_read_at: string | Date | null;
  student_last_read_at: string | Date | null;
  coach_notified_at: string | Date | null;
  student_notified_at: string | Date | null;
};

const THREAD_SELECT = `
  select c.id as coach_id, c.name as coach_name, c.email as coach_email, ${COACH_FLAG_COLUMNS},
         cl.id as client_id, cl.name as client_name, cl.email as client_email,
         cv.id as conversation_id, cv.last_message_at, cv.coach_last_read_at, cv.student_last_read_at,
         cv.coach_notified_at, cv.student_notified_at,
         (select max(l.end_at) from lessons l
          where l.coach_id = cl.coach_id and l.client_id = cl.id and l.status in ('confirmed', 'completed')) as last_valid_end
  from clients cl
  join coaches c on c.id = cl.coach_id
  left join conversations cv on cv.coach_id = cl.coach_id and cv.client_id = cl.id`;

export type ThreadContext = {
  conversationId: string | null;
  coachId: string;
  coachName: string;
  coachEmail: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  mode: MessageMode;
  reason: ModeReason;
  lastMessageAt: Date | null;
  coachLastReadAt: Date | null;
  studentLastReadAt: Date | null;
  coachNotifiedAt: Date | null;
  studentNotifiedAt: Date | null;
};

function toContext(r: ThreadRow, now: Date): ThreadContext {
  const m = messageMode({
    lastValidEnd: asDate(r.last_valid_end),
    hasConversation: Boolean(r.conversation_id),
    coachActive: coachIsActive(r),
    studentHasEmail: Boolean(r.client_email && r.client_email.trim()),
    now,
  });
  return {
    conversationId: r.conversation_id,
    coachId: r.coach_id,
    coachName: r.coach_name,
    coachEmail: r.coach_email,
    clientId: r.client_id,
    clientName: r.client_name,
    clientEmail: r.client_email,
    mode: m.mode,
    reason: m.reason,
    lastMessageAt: asDate(r.last_message_at),
    coachLastReadAt: asDate(r.coach_last_read_at),
    studentLastReadAt: asDate(r.student_last_read_at),
    coachNotifiedAt: asDate(r.coach_notified_at),
    studentNotifiedAt: asDate(r.student_notified_at),
  };
}

export async function coachThreadContext(sql: QuerySql, coachId: string, clientId: string, now = new Date()) {
  const rows = await sql.query<ThreadRow>(`${THREAD_SELECT} where cl.coach_id = $1 and cl.id = $2`, [coachId, clientId]);
  return rows[0] ? toContext(rows[0], now) : null;
}

export async function studentThreadContext(sql: QuerySql, email: string, coachId: string, now = new Date()) {
  const rows = await sql.query<ThreadRow>(
    `${THREAD_SELECT} where cl.coach_id = $1 and lower(cl.email) = $2 limit 1`,
    [coachId, normalizeEmail(email)],
  );
  return rows[0] ? toContext(rows[0], now) : null;
}

async function unreadFor(sql: QuerySql, conversationId: string, fromRole: "coach" | "student", since: Date | null) {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from messages where conversation_id = $1 and sender_role = $2 and created_at > $3`,
    [conversationId, fromRole, (since ?? new Date(0)).toISOString()],
  );
  return Number(rows[0]?.n ?? 0);
}

/** Coaches this student can see: an existing thread, or eligibility to start one. */
export async function listStudentThreads(sql: QuerySql, email: string, now = new Date()) {
  const rows = await sql.query<ThreadRow>(
    `${THREAD_SELECT} where lower(cl.email) = $1 order by cv.last_message_at desc nulls last, c.name`,
    [normalizeEmail(email)],
  );
  const out = [];
  for (const r of rows) {
    const ctx = toContext(r, now);
    if (ctx.mode === "none") continue;
    out.push({
      coachId: ctx.coachId,
      coachName: ctx.coachName,
      mode: ctx.mode,
      lastMessageAt: ctx.lastMessageAt?.toISOString() ?? null,
      unread: ctx.conversationId ? await unreadFor(sql, ctx.conversationId, "coach", ctx.studentLastReadAt) : 0,
    });
  }
  return out;
}

export async function listCoachThreads(sql: QuerySql, coachId: string, now = new Date()) {
  const rows = await sql.query<ThreadRow>(
    `${THREAD_SELECT} where cl.coach_id = $1 and cv.id is not null order by cv.last_message_at desc nulls last`,
    [coachId],
  );
  const out = [];
  for (const r of rows) {
    const ctx = toContext(r, now);
    out.push({
      clientId: ctx.clientId,
      clientName: ctx.clientName,
      mode: ctx.mode,
      lastMessageAt: ctx.lastMessageAt?.toISOString() ?? null,
      unread: await unreadFor(sql, ctx.conversationId!, "student", ctx.coachLastReadAt),
    });
  }
  return out;
}

export async function coachUnreadCount(sql: QuerySql, coachId: string) {
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n
     from messages m join conversations cv on cv.id = m.conversation_id
     where cv.coach_id = $1 and m.sender_role = 'student'
       and m.created_at > coalesce(cv.coach_last_read_at, 'epoch'::timestamptz)`,
    [coachId],
  );
  return Number(rows[0]?.n ?? 0);
}

export type MessageItem = { id: string; role: "coach" | "student"; body: string; createdAt: string };

/** Messages in order; `after` is the cursor returned with the previous page. */
export async function loadMessages(sql: QuerySql, conversationId: string | null, after?: string | null) {
  if (!conversationId) return { messages: [] as MessageItem[], cursor: after ?? null };
  const [afterAt, afterId] = String(after || "").split("|");
  const rows = afterAt
    ? await sql.query<{ id: string; sender_role: "coach" | "student"; body: string; created_at: string | Date }>(
        `select id, sender_role, body, created_at from messages
         where conversation_id = $1 and (created_at, id) > ($2::timestamptz, $3)
         order by created_at, id limit 500`,
        [conversationId, afterAt, afterId || ""],
      )
    : await sql.query<{ id: string; sender_role: "coach" | "student"; body: string; created_at: string | Date }>(
        `select id, sender_role, body, created_at from messages
         where conversation_id = $1 order by created_at, id limit 500`,
        [conversationId],
      );
  const messages = rows.map((r) => ({
    id: r.id,
    role: r.sender_role,
    body: r.body,
    createdAt: asDate(r.created_at)!.toISOString(),
  }));
  const last = messages[messages.length - 1];
  return { messages, cursor: last ? `${last.createdAt}|${last.id}` : after ?? null };
}

export type NotifyTarget = { role: "coach" | "student"; email: string; name: string; fromName: string };

export async function sendMessage(
  tx: QuerySql,
  ctx: ThreadContext,
  sender: { role: "coach" } | { role: "student"; studentId: string },
  rawBody: unknown,
  now = new Date(),
): Promise<{ ok: true; message: MessageItem; notify: NotifyTarget | null; conversationId: string } | { ok: false; error: string }> {
  if (ctx.mode !== "send") return { ok: false, error: "This conversation is read-only." };
  const clean = cleanBody(rawBody);
  if (!clean.ok) return clean;

  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const recent =
    sender.role === "student"
      ? await tx.query<{ n: number }>(
          `select count(*)::int as n from messages where sender_student_id = $1 and created_at > $2`,
          [sender.studentId, minuteAgo],
        )
      : await tx.query<{ n: number }>(
          `select count(*)::int as n from messages m join conversations cv on cv.id = m.conversation_id
           where cv.coach_id = $1 and m.sender_role = 'coach' and m.created_at > $2`,
          [ctx.coachId, minuteAgo],
        );
  if (Number(recent[0]?.n ?? 0) >= MESSAGES_PER_MINUTE) {
    return { ok: false, error: "You're sending messages too quickly. Try again in a minute." };
  }

  await tx.query(
    `insert into conversations (id, coach_id, client_id, created_at) values ($1, $2, $3, $4)
     on conflict (coach_id, client_id) do nothing`,
    [randomUUID(), ctx.coachId, ctx.clientId, now.toISOString()],
  );
  const conv = (
    await tx.query<{
      id: string;
      coach_last_read_at: string | Date | null;
      student_last_read_at: string | Date | null;
      coach_notified_at: string | Date | null;
      student_notified_at: string | Date | null;
    }>(
      `select id, coach_last_read_at, student_last_read_at, coach_notified_at, student_notified_at
       from conversations where coach_id = $1 and client_id = $2 for update`,
      [ctx.coachId, ctx.clientId],
    )
  )[0];

  const id = randomUUID();
  await tx.query(
    `insert into messages (id, conversation_id, sender_role, sender_student_id, body, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, conv.id, sender.role, sender.role === "student" ? sender.studentId : null, clean.body, now.toISOString()],
  );

  const recipient: "coach" | "student" = sender.role === "coach" ? "student" : "coach";
  const lastRead = asDate(recipient === "coach" ? conv.coach_last_read_at : conv.student_last_read_at);
  const notifiedAt = asDate(recipient === "coach" ? conv.coach_notified_at : conv.student_notified_at);
  const recipientEmail = recipient === "coach" ? ctx.coachEmail : ctx.clientEmail;
  const notify = Boolean(recipientEmail) && shouldNotify({ lastReadAt: lastRead, notifiedAt, now });

  const senderRead = sender.role === "coach" ? "coach_last_read_at" : "student_last_read_at";
  const recipientNotified = recipient === "coach" ? "coach_notified_at" : "student_notified_at";
  await tx.query(
    `update conversations set last_message_at = $1, ${senderRead} = $1
       ${notify ? `, ${recipientNotified} = $1` : ""}
     where id = $2`,
    [now.toISOString(), conv.id],
  );

  return {
    ok: true,
    conversationId: conv.id,
    message: { id, role: sender.role, body: clean.body, createdAt: now.toISOString() },
    notify: notify
      ? {
          role: recipient,
          email: recipientEmail!,
          name: recipient === "coach" ? ctx.coachName : ctx.clientName,
          fromName: recipient === "coach" ? ctx.clientName : ctx.coachName,
        }
      : null,
  };
}

export async function markRead(sql: QuerySql, conversationId: string | null, role: "coach" | "student", now = new Date()) {
  if (!conversationId) return;
  const column = role === "coach" ? "coach_last_read_at" : "student_last_read_at";
  await sql.query(`update conversations set ${column} = $1 where id = $2`, [now.toISOString(), conversationId]);
}
