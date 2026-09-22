/**
 * Student cookie session — server-only (`.server.ts`: imports request context).
 */
import { deleteCookie, getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { STUDENT_COOKIE } from "./student-auth";
import { revokeSession, sessionFromToken, type StudentIdentity } from "./student-service";

const secure = () => process.env.NODE_ENV === "production";

export function setStudentCookie(token: string, expires: Date) {
  setCookie(STUDENT_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    expires,
  });
}

export async function currentStudent(): Promise<StudentIdentity | null> {
  assertSameSiteRequest();
  const sql = await getSql();
  return sessionFromToken(sql, getCookie(STUDENT_COOKIE));
}

export async function clearStudentSession() {
  assertSameSiteRequest();
  const sql = await getSql();
  await revokeSession(sql, getCookie(STUDENT_COOKIE));
  deleteCookie(STUDENT_COOKIE, { path: "/" });
}

export function requestIp() {
  const forwarded = getRequestHeader("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0]?.trim() : "";
  return first || getRequestIP() || null;
}
