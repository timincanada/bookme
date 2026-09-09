import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { validateWeeklyHours } from "@/lib/hours";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { hours } = await req.json();
  const validated = validateWeeklyHours(hours);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  await prisma.weeklyHour.deleteMany({ where: { coachId: coach.id } });
  await prisma.weeklyHour.createMany({
    data: validated.rows.map((h) => ({
      coachId: coach.id,
      weekday: h.weekday,
      startMin: h.startMin,
      endMin: h.endMin,
    })),
  });
  return NextResponse.json({ count: validated.rows.length });
}
