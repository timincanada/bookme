import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { canConfirmCheckout } from "@/lib/hold";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  }
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const lessonId = session.metadata?.lessonId;
    if (!lessonId) return NextResponse.json({ received: true });
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { payment: true },
    });
    if (!lesson) return NextResponse.json({ received: true });
    if (lesson.status === "confirmed") return NextResponse.json({ received: true });
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!canConfirmCheckout(lesson.status, lesson.holdUntil)) {
      if (pi) await stripe.refunds.create({ payment_intent: pi });
      if (lesson.status === "held") {
        await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "expired" } });
      }
      await prisma.payment.update({
        where: { lessonId: lesson.id },
        data: { status: "refunded", stripePaymentIntentId: pi ?? undefined },
      });
      return NextResponse.json({ received: true, rejected: "hold_expired" });
    }
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "confirmed" } });
    await prisma.payment.update({
      where: { lessonId: lesson.id },
      data: {
        status: "paid",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: pi ?? undefined,
      },
    });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const lessonId = session.metadata?.lessonId;
    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
      if (lesson?.status === "held") {
        await prisma.lesson.update({ where: { id: lessonId }, data: { status: "expired" } });
      }
    }
  }

  return NextResponse.json({ received: true });
}
