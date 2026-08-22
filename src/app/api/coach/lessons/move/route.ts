import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { canMoveLesson, statusAfterReschedule } from "@/lib/hold";
import { changeMails, sendMail } from "@/lib/mail";
import { formatWhen } from "@/lib/time";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { lessonId, start } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { client: true, service: true, location: true, payment: true, coach: true },
  });
  if (!lesson || lesson.coachId !== coach.id) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (!canMoveLesson(lesson.status)) {
    return NextResponse.json({ error: "That lesson cannot be moved" }, { status: 400 });
  }
  const startAt = new Date(start);
  const dateKey = startAt.toISOString().slice(0, 10);
  const slots = await openSlots(lesson.coachId, dateKey, lesson.service.duration);
  if (!slots.includes(startAt.toISOString())) {
    return NextResponse.json({ error: "That time is not open" }, { status: 409 });
  }
  const endAt = new Date(startAt.getTime() + lesson.service.duration * 60 * 1000);
  const when = formatWhen(lesson.startAt);
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { startAt, endAt, status: statusAfterReschedule(lesson.status) },
  });
  for (const mail of changeMails({
    kind: "rescheduled",
    coachName: lesson.coach.name,
    coachEmail: lesson.coach.email,
    studentName: lesson.client.name,
    studentEmail: lesson.client.email,
    when,
    nextWhen: formatWhen(startAt),
  })) {
    await sendMail(mail);
  }
  return NextResponse.json({ ok: true, status: statusAfterReschedule(lesson.status) });
}
