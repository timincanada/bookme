import { cookies } from "next/headers";
import { prisma } from "./db";
import { readSession, readStudent, SESSION_COOKIE, STUDENT_COOKIE } from "./auth";

export async function currentCoach() {
  const id = readSession(cookies().get(SESSION_COOKIE)?.value);
  if (!id) return null;
  return prisma.coach.findUnique({
    where: { id },
    include: { services: true, locations: true, hours: true },
  });
}

export function currentStudentEmail() {
  return readStudent(cookies().get(STUDENT_COOKIE)?.value);
}
