import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { canAcceptNewBookings } from "@/lib/subscription";
import { holdExpiresAt } from "@/lib/hold";
import { nextWeekStart } from "@/lib/change";
import { appUrl, getStripe } from "@/lib/stripe";
import { changeMails, sendMail } from "@/lib/mail";
import { formatWhen } from "@/lib/time";
import { notifyLessonConfirmed } from "@/lib/mail-send";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!canAcceptNewBookings(coach.subscriptionStatus)) {
    return NextResponse.json({ error: "Start a trial to book next week" }, { status: 403 });
  }
  const { lessonId } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { client: true, service: true, location: true, payment: true, coach: true },
  });
  if (!lesson || lesson.coachId !== coach.id) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (lesson.status !== "confirmed") {
    return NextResponse.json({ error: "Only a confirmed lesson can book next week" }, { status: 400 });
  }
  const startAt = nextWeekStart(lesson.startAt);
  const dateKey = startAt.toISOString().slice(0, 10);
  const slots = await openSlots(lesson.coachId, dateKey, lesson.service.duration);
  if (!slots.includes(startAt.toISOString())) {
    return NextResponse.json({ error: "That time next week is not open" }, { status: 409 });
  }
  const endAt = new Date(startAt.getTime() + lesson.service.duration * 60 * 1000);
  const amount = lesson.payment?.amountCad || lesson.service.priceCad;
  const cash = lesson.payment?.method !== "card";

  if (cash) {
    const created = await prisma.lesson.create({
      data: {
        coachId: lesson.coachId,
        serviceId: lesson.serviceId,
        locationId: lesson.locationId,
        clientId: lesson.clientId,
        startAt,
        endAt,
        status: "confirmed",
        payment: { create: { method: "cash", status: "unpaid", amountCad: amount } },
      },
    });
    await notifyLessonConfirmed(created.id);
    return NextResponse.json({ id: created.id });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Card checkout is not configured" }, { status: 503 });
  }
  const created = await prisma.lesson.create({
    data: {
      coachId: lesson.coachId,
      serviceId: lesson.serviceId,
      locationId: lesson.locationId,
      clientId: lesson.clientId,
      startAt,
      endAt,
      status: "held",
      holdUntil: holdExpiresAt(),
      payment: { create: { method: "card", status: "unpaid", amountCad: amount } },
    },
  });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    adaptive_pricing: { enabled: false },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    customer_email: lesson.client.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: amount * 100,
          product_data: { name: `${lesson.service.name} with ${lesson.coach.name}` },
        },
      },
    ],
    metadata: { lessonId: created.id },
    success_url: `${appUrl()}/book/done?id=${created.id}`,
    cancel_url: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client.email)}`,
  });
  await prisma.payment.update({
    where: { lessonId: created.id },
    data: { stripeCheckoutSessionId: session.id },
  });
  for (const mail of changeMails({
    kind: "next_week_card",
    coachName: lesson.coach.name,
    coachEmail: lesson.coach.email,
    studentName: lesson.client.name,
    studentEmail: lesson.client.email,
    when: formatWhen(lesson.startAt),
    nextWhen: formatWhen(startAt),
    payUrl: session.url || "",
  })) {
    await sendMail(mail);
  }
  return NextResponse.json({ id: created.id, checkoutUrl: session.url });
}
