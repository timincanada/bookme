import { cookies } from "next/headers";
import { prisma } from "./db";
import { readSession, readStudent, SESSION_COOKIE, STUDENT_COOKIE } from "./auth";

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

export function currentStudentEmail() {
  return readStudent(cookies().get(STUDENT_COOKIE)?.value);
}
