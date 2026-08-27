import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { readSession, readStudent, SESSION_COOKIE, STUDENT_COOKIE } from "./auth";
import { isAdminEmail } from "./admin";

export async function currentCoach() {
  const id = readSession(cookies().get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const coach = await prisma.coach.findUnique({
    where: { id },
    include: { services: true, locations: true, hours: true },
  });
  if (!coach || coach.banned) return null;
  return coach;
}

export async function requireAdmin() {
  const coach = await currentCoach();
  if (!coach) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  if (!isAdminEmail(coach.email)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not allowed" }, { status: 403 }),
    };
  }
  return { ok: true as const, coach };
}

export function currentStudentEmail() {
  return readStudent(cookies().get(STUDENT_COOKIE)?.value);
}
