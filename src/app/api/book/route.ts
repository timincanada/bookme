import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { holdExpiresAt } from "@/lib/hold";
import { appUrl, getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { slug, start, name, email, method } = await req.json();
  if (!slug || !start || !name || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const coach = await prisma.coach.findUnique({
    where: { slug },
    include: { services: true, locations: { where: { active: true } } },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  const service = coach.services[0];
  const location = coach.locations[0];
  if (!service || !location) return NextResponse.json({ error: "Coach is not set up" }, { status: 400 });

  const startAt = new Date(start);
  const dateKey = startAt.toISOString().slice(0, 10);
  const slots = await openSlots(coach.id, dateKey, service.duration);
  if (!slots.includes(startAt.toISOString())) {
    return NextResponse.json({ error: "That time is no longer open" }, { status: 409 });
  }

  const client = await prisma.client.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });

  const endAt = new Date(startAt.getTime() + service.duration * 60 * 1000);
  const cash = method !== "card";

  if (cash) {
    const lesson = await prisma.lesson.create({
      data: {
        coachId: coach.id,
        serviceId: service.id,
        locationId: location.id,
        clientId: client.id,
        startAt,
        endAt,
        status: "confirmed",
        payment: {
          create: {
            method: "cash",
            status: "unpaid",
            amountCad: service.priceCad,
          },
        },
      },
    });
    return NextResponse.json({ id: lesson.id });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Card checkout is not configured. Set STRIPE_SECRET_KEY." },
      { status: 503 }
    );
  }

  const holdUntil = holdExpiresAt();
  const lesson = await prisma.lesson.create({
    data: {
      coachId: coach.id,
      serviceId: service.id,
      locationId: location.id,
      clientId: client.id,
      startAt,
      endAt,
      status: "held",
      holdUntil,
      payment: {
        create: {
          method: "card",
          status: "unpaid",
          amountCad: service.priceCad,
        },
      },
    },
  });

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "payment",
    // Stripe Checkout minimum expiry is 30 minutes; our slot hold is 15.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: service.priceCad * 100,
          product_data: { name: `${service.name} with ${coach.name}` },
        },
      },
    ],
    metadata: { lessonId: lesson.id },
    success_url: `${appUrl()}/book/done?id=${lesson.id}`,
    cancel_url: `${appUrl()}/book/pay?coach=${slug}&start=${encodeURIComponent(start)}`,
  };
  if (coach.stripeAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: 0,
      transfer_data: { destination: coach.stripeAccountId },
    };
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    await prisma.payment.update({
      where: { lessonId: lesson.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    return NextResponse.json({ id: lesson.id, checkoutUrl: session.url });
  } catch (err) {
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "cancelled" } });
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
