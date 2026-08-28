import { NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";
import { planCapabilities, effectiveSubscriptionStatus } from "@/lib/subscription";
import { expireStaleTrial } from "@/lib/subscription-sync";

export async function GET() {
  const raw = await currentCoach();
  if (!raw) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const coach = await expireStaleTrial(raw);
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
    subscriptionStatus: effectiveSubscriptionStatus(coach.subscriptionStatus, coach.trialEndsAt),
    plan: coach.plan,
    setup,
    canCopyLink: canCopyBookingLink(setup, coach.subscriptionStatus, coach.trialEndsAt, {
      banned: coach.banned,
      accessGrant: coach.accessGrant,
    }),
    service: coach.services[0] || null,
    stripeConnected: !!coach.stripeAccountId,
    acceptCard: coach.acceptCard,
    acceptCash: coach.acceptCash,
    locations: coach.locations,
    hours: coach.hours,
    capabilities: planCapabilities(coach.plan, coach.subscriptionStatus, coach.trialEndsAt),
  });
}
