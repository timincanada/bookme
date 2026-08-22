import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentStudentEmail } from "@/lib/session";

export async function GET() {
  const email = currentStudentEmail();
  if (!email) return NextResponse.json({ error: "Verify your email first" }, { status: 401 });
  const client = await prisma.client.findUnique({ where: { email } });
  if (!client) return NextResponse.json({ lessons: [] });
  const lessons = await prisma.lesson.findMany({
    where: { clientId: client.id },
    include: { coach: true, payment: true, location: true },
    orderBy: { startAt: "desc" },
  });
  return NextResponse.json({
    email,
    lessons: lessons.map((l) => ({
      id: l.id,
      coachName: l.coach.name,
      coachSlug: l.coach.slug,
      startAt: l.startAt,
      status: l.status,
      method: l.payment?.method,
      payStatus: l.payment?.status,
      location: l.location.name,
    })),
  });
}
