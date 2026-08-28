import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { hashPassword, readSession, readStudent, SESSION_COOKIE, STAFF_COOKIE, STUDENT_COOKIE } from "./auth";
import { ADMIN_EMAIL } from "./admin";

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

export async function ensureStaff() {
  const email = ADMIN_EMAIL;
  const password = process.env.STAFF_PASSWORD;
  const passwordHash = password ? hashPassword(password) : "";
  if (password) {
    return prisma.staff.upsert({
      where: { email },
      create: { email, passwordHash },
      update: { passwordHash },
    });
  }
  return prisma.staff.upsert({
    where: { email },
    create: { email, passwordHash: "" },
    update: {},
  });
}

export async function currentStaff() {
  const id = readSession(cookies().get(STAFF_COOKIE)?.value);
  if (!id) return null;
  return prisma.staff.findUnique({ where: { id } });
}

export async function requireAdmin() {
  const id = readSession(cookies().get(STAFF_COOKIE)?.value);
  if (!id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not allowed" }, { status: 403 }),
    };
  }
  return { ok: true as const, staff };
}

export function currentStudentEmail() {
  return readStudent(cookies().get(STUDENT_COOKIE)?.value);
}
