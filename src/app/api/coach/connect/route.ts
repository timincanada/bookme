import { NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl, getStripe } from "@/lib/stripe";

function stripeMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Stripe error";
}

function stripeStatus(err: unknown) {
  if (err && typeof err === "object" && "statusCode" in err) {
    const code = (err as { statusCode?: unknown }).statusCode;
    if (typeof code === "number" && code >= 400 && code < 600) return code;
  }
  return 502;
}

async function createCoachAccount(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  coach: { id: string; email: string },
) {
  const base = {
    type: "express" as const,
    country: "CA",
    email: coach.email,
    metadata: { coachId: coach.id },
  };
  try {
    return await stripe.accounts.create({
      ...base,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
  } catch (err) {
    const message = stripeMessage(err);
    if (/signed up for Connect/i.test(message)) throw err;
    return await stripe.accounts.create(base);
  }
}

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
  try {
    let accountId = coach.stripeAccountId;
    if (!accountId) {
      const account = await createCoachAccount(stripe, coach);
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
  } catch (err) {
    const message = stripeMessage(err);
    const needsConnectSignup = /signed up for Connect/i.test(message);
    return NextResponse.json(
      {
        error: needsConnectSignup
          ? "Turn on Stripe Connect at dashboard.stripe.com/connect, then try Card again"
          : message,
      },
      { status: stripeStatus(err) },
    );
  }
}
