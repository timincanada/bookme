/**
 * Messaging server functions. Students authenticate with the portal cookie;
 * coaches with the app session. No admin access to message bodies.
 */
import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql, withTransaction } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { coachForUser } from "./api";
import { publicAppUrl as appUrl } from "./app-url";
import { newMessageMail, sendMail } from "./mail";
import { pushToCoach, pushToStudentEmail } from "./push";
import { MODE_REASON_TEXT } from "./messages";
import {
  coachThreadContext,
  listCoachThreads,
  listStudentThreads,
  loadMessages,
  markRead,
  sendMessage,
  studentThreadContext,
  type NotifyTarget,
  type ThreadContext,
} from "./messages-service";
import { loadThreadCards } from "./thread-cards";
const currentStudent = async () => (await import("./student-session.server")).currentStudent();

const SIGN_IN = "Sign in with your email first.";

function threadView(ctx: ThreadContext, side: "coach" | "student") {
  return {
    mode: ctx.mode,
    note: MODE_REASON_TEXT[ctx.reason],
    otherName: side === "coach" ? ctx.clientName : ctx.coachName,
  };
}

async function notify(target: NotifyTarget | null, ctx: ThreadContext) {
  if (!target) return;
  const link =
    target.role === "student"
      ? `${appUrl()}/manage/messages/${encodeURIComponent(ctx.coachId)}`
      : `${appUrl()}/app/messages/${encodeURIComponent(ctx.clientId)}`;
  await sendMail(
    newMessageMail({ to: target.email, name: target.name, fromName: target.fromName, link }),
    {
      template: "new_message",
    },
  );
  // Same cooldown as email; never includes the message text.
  const push = {
    title: "New message",
    body: `From ${target.fromName}`,
    path:
      target.role === "student"
        ? `/manage/messages/${encodeURIComponent(ctx.coachId)}`
        : `/app/messages/${encodeURIComponent(ctx.clientId)}`,
  };
  const sql = await getSql();
  await (
    target.role === "student"
      ? pushToStudentEmail(sql, ctx.clientEmail, push)
      : pushToCoach(sql, ctx.coachId, push)
  ).catch(() => undefined);
}

// ---- Student ---------------------------------------------------------------

export const studentListConversations = createServerFn({ method: "GET" }).handler(async () => {
  const me = await currentStudent();
  if (!me) return { ok: false as const, error: SIGN_IN };
  const sql = await getSql();
  return { ok: true as const, threads: await listStudentThreads(sql, me.email) };
});

export const studentGetThread = createServerFn({ method: "GET" })
  .validator((input: { coachId: string; after?: string | null }) => guardInput(input))
  .handler(async ({ data }) => {
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: SIGN_IN };
    const sql = await getSql();
    const ctx = await studentThreadContext(sql, me.email, String(data.coachId || ""));
    if (!ctx || ctx.mode === "none")
      return { ok: false as const, error: "Conversation not found." };
    const page = await loadMessages(sql, ctx.conversationId, data.after);
    return { ok: true as const, thread: threadView(ctx, "student"), ...page };
  });

export const studentSendMessage = createServerFn({ method: "POST" })
  .validator((input: { coachId: string; body: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: SIGN_IN };
    const result = await withTransaction(async (tx) => {
      const ctx = await studentThreadContext(tx, me.email, String(data.coachId || ""));
      if (!ctx || ctx.mode === "none")
        return { ok: false as const, error: "Conversation not found." };
      const sent = await sendMessage(
        tx,
        ctx,
        { role: "student", studentId: me.studentId },
        data.body,
      );
      return sent.ok ? { ...sent, ctx } : sent;
    });
    if (!result.ok) return result;
    await notify(result.notify, result.ctx);
    return { ok: true as const, message: result.message };
  });

export const studentMarkRead = createServerFn({ method: "POST" })
  .validator((input: { coachId: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: SIGN_IN };
    const sql = await getSql();
    const ctx = await studentThreadContext(sql, me.email, String(data.coachId || ""));
    if (ctx) await markRead(sql, ctx.conversationId, "student");
    return { ok: true as const };
  });

// ---- Coach -----------------------------------------------------------------

export const coachListConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    return { ok: true as const, threads: await listCoachThreads(sql, coach.id) };
  });

export const coachGetThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string; after?: string | null }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const ctx = await coachThreadContext(sql, coach.id, String(data.clientId || ""));
    if (!ctx) return { ok: false as const, error: "Client not found" };
    const page = await loadMessages(sql, ctx.conversationId, data.after);
    return { ok: true as const, thread: threadView(ctx, "coach"), ...page };
  });

export const coachSendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string; body: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const result = await withTransaction(async (tx) => {
      const ctx = await coachThreadContext(tx, coach.id, String(data.clientId || ""));
      if (!ctx) return { ok: false as const, error: "Client not found" };
      if (ctx.mode !== "send")
        return {
          ok: false as const,
          error: MODE_REASON_TEXT[ctx.reason] || "This conversation is read-only.",
        };
      const sent = await sendMessage(tx, ctx, { role: "coach" }, data.body);
      return sent.ok ? { ...sent, ctx } : sent;
    });
    if (!result.ok) return result;
    await notify(result.notify, result.ctx);
    return { ok: true as const, message: result.message };
  });

export const coachMarkRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const ctx = await coachThreadContext(sql, coach.id, String(data.clientId || ""));
    if (ctx) await markRead(sql, ctx.conversationId, "coach");
    return { ok: true as const };
  });

/** Message availability for a client (used by client / lesson pages). */
export const coachMessageStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const ctx = await coachThreadContext(sql, coach.id, String(data.clientId || ""));
    if (!ctx) return { ok: false as const, error: "Client not found" };
    return { ok: true as const, ...threadView(ctx, "coach") };
  });

const EMPTY_CARDS = { pending: null, booking: null };

/** Next booking and open swap/move for the coach's thread with this client. */
export const coachThreadCards = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string }) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    const cards = await loadThreadCards(sql, {
      viewer: "coach",
      coachId: coach.id,
      clientId: String(data.clientId || ""),
    });
    return { ok: true as const, ...cards };
  });

/** Same cards for the signed-in student, scoped to one coach. */
export const studentThreadCards = createServerFn({ method: "GET" })
  .validator((input: { coachId: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: SIGN_IN, ...EMPTY_CARDS };
    const sql = await getSql();
    const cards = await loadThreadCards(sql, {
      viewer: "student",
      coachId: String(data.coachId || ""),
      email: me.email,
    });
    return { ok: true as const, ...cards };
  });
