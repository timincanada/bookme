import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  const coach = await prisma.coach.findUnique({ where: { slug: slug || "tim-zhang" } });
  if (!coach?.stripeSubscriptionId) {
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
