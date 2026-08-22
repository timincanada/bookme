import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { lessonId } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { payment: true },
  });
  if (!lesson?.payment || lesson.status === "cancelled") {
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
