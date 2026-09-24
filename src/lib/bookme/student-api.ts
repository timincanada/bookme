/**
 * Student portal sign-in (email code or magic link) and session.
 */
import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql } from "@/lib/db";
import { publicAppUrl as appUrl } from "./app-url";
import { manageLinkMail, productionMailConfigError, sendMail } from "./mail";
import { devShowsCode } from "./student-auth";
const session = () => import("./student-session.server");
import { createSession, requestCode, verifyCode, verifyToken, type VerifyResult } from "./student-service";

const SENT = "If we have bookings for that email, we sent a one-time link and a 6-digit code. It expires in 30 minutes.";

export const requestStudentCode = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const configError = productionMailConfigError();
    if (configError) {
      console.error(JSON.stringify({ msg: "student_code_undelivered", template: "student_code", error: configError }));
      return {
        sent: false as const,
        message: "We couldn't send a sign-in email right now. Try again in a few minutes.",
      };
    }
    const sql = await getSql();
    const result = await requestCode(sql, String(data?.email || ""), (await session()).requestIp());
    if (!result.issue) return { sent: true as const, message: SENT };
    const delivery = await sendMail(
      manageLinkMail({ email: result.email, link: `${appUrl()}/manage?token=${result.token}`, code: result.code }),
      { template: "student_code" },
    );
    if (!delivery.ok) {
      console.error(JSON.stringify({ msg: "student_code_undelivered", template: "student_code", error: delivery.error }));
    }
    return devShowsCode()
      ? { sent: true as const, message: SENT, previewCode: result.code }
      : { sent: true as const, message: SENT };
  });

async function startSession(result: VerifyResult) {
  if (!result.ok) return { ok: false as const, error: result.error };
  const sql = await getSql();
  const created = await createSession(sql, result.studentId, result.email);
  (await import("./student-session.server")).setStudentCookie(created.token, created.expires);
  return { ok: true as const, email: result.email };
}

export const verifyStudentCode = createServerFn({ method: "POST" })
  .validator((input: { email: string; code: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return startSession(await verifyCode(sql, String(data?.email || ""), String(data?.code || "")));
  });

export const verifyStudentLink = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return startSession(await verifyToken(sql, String(data?.token || "")));
  });

export const getStudentMe = createServerFn({ method: "GET" }).handler(async () => {
  const me = await (await session()).currentStudent();
  return me ? { signedIn: true as const, email: me.email } : { signedIn: false as const };
});

export const studentSignOut = createServerFn({ method: "POST" }).handler(async () => {
  await (await session()).clearStudentSession();
  return { ok: true as const };
});

/** Whether the demo student shortcut may be shown (never in production unless allowed). */
export const demoAvailable = createServerFn({ method: "GET" }).handler(async () => ({
  demo: process.env.NODE_ENV !== "production" || process.env.BOOKME_ALLOW_DEMO === "1",
}));
