import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") || "";
  const client = await prisma.client.findUnique({ where: { email } });
  if (!client) return NextResponse.json({ lessons: [] });
  const lessons = await prisma.lesson.findMany({
    where: { clientId: client.id },
    include: { coach: true, payment: true, location: true },
    orderBy: { startAt: "desc" },
  });
  return NextResponse.json({
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
