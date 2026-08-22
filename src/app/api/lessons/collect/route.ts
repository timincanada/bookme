import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentCoach } from "@/lib/session";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { lessonId } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { payment: true },
  });
  if (!lesson?.payment || lesson.coachId !== coach.id || lesson.status === "cancelled") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (lesson.payment.method !== "cash") {
    return NextResponse.json({ error: "Only cash bookings can be marked collected" }, { status: 400 });
  }
  await prisma.payment.update({
    where: { lessonId },
    data: { status: "marked_offline" },
  });
  return NextResponse.json({ ok: true });
}
