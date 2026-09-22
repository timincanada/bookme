import { createServerFn } from "@tanstack/react-start";
import { guardInput } from "./input-guard";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { coachForUser } from "./api";
import { registerDevice } from "./push";

type DeviceInput = { token: string; platform: "ios" | "android" };

export const registerCoachDevice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: DeviceInput) => guardInput(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const coach = await coachForUser(sql, context.userId);
    if (!coach) return { ok: false as const, error: "Sign in required" };
    return registerDevice(sql, { coachId: coach.id }, data);
  });

export const registerStudentDevice = createServerFn({ method: "POST" })
  .validator((input: DeviceInput) => guardInput(input))
  .handler(async ({ data }) => {
    const { currentStudent } = await import("./student-session.server");
    const me = await currentStudent();
    if (!me) return { ok: false as const, error: "Sign in required" };
    const sql = await getSql();
    return registerDevice(sql, { studentId: me.studentId }, data);
  });

/** Called on sign-out so a shared phone stops receiving the previous person's pushes. */
export const unregisterDevice = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => guardInput(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(`delete from device_tokens where token = $1`, [String(data?.token || "")]);
    return { ok: true as const };
  });
