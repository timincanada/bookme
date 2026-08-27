import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { nextWeekStart } from "@/lib/change";
import { notifyLessonConfirmed } from "@/lib/mail-send";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { lessonId } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { client: true, service: true, location: true, coach: true },
  });
  if (!lesson || lesson.coachId !== coach.id) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (lesson.status !== "confirmed") {
    return NextResponse.json({ error: "Only a confirmed lesson can book next week" }, { status: 400 });
  }
  const startAt = nextWeekStart(lesson.startAt);
  const dateKey = startAt.toISOString().slice(0, 10);
  const slots = await openSlots(lesson.coachId, dateKey, lesson.service.duration);
  if (!slots.includes(startAt.toISOString())) {
    return NextResponse.json({ error: "That time next week is not open" }, { status: 409 });
  }
  const endAt = new Date(startAt.getTime() + lesson.service.duration * 60 * 1000);
  const created = await prisma.lesson.create({
    data: {
      coachId: lesson.coachId,
      serviceId: lesson.serviceId,
      locationId: lesson.locationId,
      clientId: lesson.clientId,
      startAt,
      endAt,
      status: "confirmed",
    },
  });
  await notifyLessonConfirmed(created.id);
  return NextResponse.json({ id: created.id });
}
