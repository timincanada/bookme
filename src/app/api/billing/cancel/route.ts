import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentCoach } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!coach.stripeSubscriptionId) {
    return NextResponse.json({ error: "No subscription" }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  await stripe.subscriptions.cancel(coach.stripeSubscriptionId);
  await prisma.coach.update({
    where: { id: coach.id },
    data: { subscriptionStatus: "canceled" },
  });
  return NextResponse.json({ ok: true });
}
