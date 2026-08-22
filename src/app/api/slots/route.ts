import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("coach") || "tim-zhang";
  const date = req.nextUrl.searchParams.get("date");
  const coach = await prisma.coach.findUnique({
    where: { slug },
    include: { services: true },
  });
  if (!coach || !date) return NextResponse.json({ slots: [] });
  const duration = coach.services[0]?.duration || 60;
  const slots = await openSlots(coach.id, date, duration);
  return NextResponse.json({
    slots,
    coachName: coach.name,
    duration,
    priceCad: coach.services[0]?.priceCad || 80,
  });
}
