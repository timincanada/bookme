import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl, getStripe } from "@/lib/stripe";
import { TRIAL_DAYS } from "@/lib/subscription";

export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  const coach = await prisma.coach.findUnique({ where: { slug: slug || "tim-zhang" } });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  const stripe = getStripe();
  const price = process.env.STRIPE_COACH_PRICE_ID;
  if (!stripe || !price) {
    return NextResponse.json(
      { error: "Coach billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_COACH_PRICE_ID." },
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
