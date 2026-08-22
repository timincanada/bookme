import { NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";

export async function GET() {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const setup = isSetupComplete({
    title: coach.title,
    timezone: coach.timezone,
    service: coach.services[0] || null,
    locationCount: coach.locations.filter((l) => l.active).length,
    hourCount: coach.hours.length,
  });
  return NextResponse.json({
    id: coach.id,
    slug: coach.slug,
    name: coach.name,
    email: coach.email,
    title: coach.title,
    city: coach.city,
    timezone: coach.timezone,
    subscriptionStatus: coach.subscriptionStatus,
    plan: coach.plan,
    setup,
    canCopyLink: canCopyBookingLink(setup, coach.subscriptionStatus),
    service: coach.services[0] || null,
    locations: coach.locations,
    hours: coach.hours,
  });
}
