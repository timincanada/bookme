import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { hours } = await req.json();
  if (!Array.isArray(hours)) return NextResponse.json({ error: "Hours required" }, { status: 400 });
  await prisma.weeklyHour.deleteMany({ where: { coachId: coach.id } });
  const rows = hours
    .filter((h: { weekday: number; startMin: number; endMin: number }) => h.endMin > h.startMin)
    .map((h: { weekday: number; startMin: number; endMin: number }) => ({
      coachId: coach.id,
      weekday: Number(h.weekday),
      startMin: Number(h.startMin),
      endMin: Number(h.endMin),
    }));
  if (rows.length) await prisma.weeklyHour.createMany({ data: rows });
  return NextResponse.json({ count: rows.length });
}
