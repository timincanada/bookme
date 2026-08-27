import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { canAcceptNewBookings } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("coach") || "tim-zhang";
  const date = req.nextUrl.searchParams.get("date");
  const coach = await prisma.coach.findUnique({
    where: { slug },
    include: { services: true, locations: { where: { active: true } } },
  });
  if (!coach || !date) return NextResponse.json({ slots: [] });
  const duration = coach.services[0]?.duration || 60;
  const slots = await openSlots(coach.id, date, duration);
  return NextResponse.json({
    slots,
    accepting: !coach.banned && canAcceptNewBookings(coach.subscriptionStatus, coach.trialEndsAt),
    coachName: coach.name,
    duration,
    locations: coach.locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      kind: l.kind,
    })),
  });
}
