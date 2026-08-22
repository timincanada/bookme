import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { canAcceptNewBookings } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("coach") || "tim-zhang";
  const date = req.nextUrl.searchParams.get("date");
  const coach = await prisma.coach.findUnique({
    where: { slug },
    include: { services: true },
  });
  if (!coach || !date) return NextResponse.json({ slots: [] });
  const accepting = canAcceptNewBookings(coach.subscriptionStatus);
  const duration = coach.services[0]?.duration || 60;
  const slots = await openSlots(coach.id, date, duration);
  return NextResponse.json({
    slots,
    accepting,
    coachName: coach.name,
    duration,
    priceCad: coach.services[0]?.priceCad || 80,
    acceptCard: coach.acceptCard,
    acceptCash: coach.acceptCash,
  });
}
