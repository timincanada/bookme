import { NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl, getStripe } from "@/lib/stripe";

export async function GET() {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json({ connected: !!coach.stripeAccountId });
}

export async function POST() {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  let accountId = coach.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "CA",
      email: coach.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { coachId: coach.id },
    });
    accountId = account.id;
    await prisma.coach.update({ where: { id: coach.id }, data: { stripeAccountId: accountId } });
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/app/more/payments?connect=refresh`,
    return_url: `${appUrl()}/app/more/payments?connect=return`,
    type: "account_onboarding",
  });
  return NextResponse.json({ url: link.url, connected: true });
}
