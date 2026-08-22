import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentCoach } from "@/lib/session";
import { appUrl, getStripe } from "@/lib/stripe";
import { priceIdForPlan, TRIAL_DAYS } from "@/lib/subscription";

export async function POST() {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const stripe = getStripe();
  const price = priceIdForPlan("light");
  if (!stripe || !price) {
    return NextResponse.json(
      { error: "Coach billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_LIGHT." },
      { status: 503 },
    );
  }

  let customerId = coach.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: coach.email,
      name: coach.name,
      metadata: { coachId: coach.id, kind: "coach_subscription" },
    });
    customerId = customer.id;
    await prisma.coach.update({ where: { id: coach.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: coach.id,
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: "always",
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { coachId: coach.id, kind: "coach_subscription" },
    },
    metadata: { coachId: coach.id, kind: "coach_subscription" },
    success_url: `${appUrl()}/app/billing?started=1`,
    cancel_url: `${appUrl()}/app/billing`,
  });
  return NextResponse.json({ checkoutUrl: session.url });
}
