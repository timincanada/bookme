import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("coach") || "tim-zhang";
  const date = req.nextUrl.searchParams.get("date");
  const coach = await prisma.coach.findUnique({
    where: { slug },
    include: { services: true, locations: { where: { active: true } }, hours: true },
  });
  if (!coach || !date) return NextResponse.json({ slots: [] });
  const duration = coach.services[0]?.duration || 60;
  const setup = isSetupComplete({
    title: coach.title,
    timezone: coach.timezone,
    service: coach.services[0] || null,
    locationCount: coach.locations.length,
    hourCount: coach.hours.length,
  });
  const accepting = canCopyBookingLink(
    setup,
    coach.subscriptionStatus,
    coach.trialEndsAt,
    coach.banned,
    coach.accessGrant,
  );
  const slots = accepting ? await openSlots(coach.id, date, duration) : [];
  return NextResponse.json({
    slots,
    accepting,
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
