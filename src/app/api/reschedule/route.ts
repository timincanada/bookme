import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { getStripe } from "@/lib/stripe";
import { canSelfReschedule } from "@/lib/hold";

export async function POST(req: NextRequest) {
  const { lessonId, email, start, action } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { client: true, service: true, payment: true, coach: true },
  });
  if (!lesson || lesson.client.email.toLowerCase() !== String(email).toLowerCase()) {
    return NextResponse.json({ error: "Lesson not found for that email" }, { status: 404 });
  }
  const selfServe = canSelfReschedule(lesson.startAt);
  if (action === "cancel") {
    if (!selfServe && lesson.payment?.method === "card") {
      await prisma.payment.update({ where: { lessonId }, data: { status: "no_refund" } });
    } else if (lesson.payment?.method === "card") {
      const stripe = getStripe();
      if (stripe && lesson.payment.stripePaymentIntentId && lesson.payment.status === "paid") {
        await stripe.refunds.create({ payment_intent: lesson.payment.stripePaymentIntentId });
      }
      await prisma.payment.update({ where: { lessonId }, data: { status: "refunded" } });
    }
    await prisma.lesson.update({ where: { id: lessonId }, data: { status: "cancelled" } });
    return NextResponse.json({ ok: true });
  }
  if (!selfServe) {
    return NextResponse.json({ error: "Within 24 hours, reschedule needs the coach. Email them or cancel." }, { status: 400 });
  }
  const startAt = new Date(start);
  const dateKey = startAt.toISOString().slice(0, 10);
  const slots = await openSlots(lesson.coachId, dateKey, lesson.service.duration);
  if (!slots.includes(startAt.toISOString())) {
    return NextResponse.json({ error: "That time is not open" }, { status: 409 });
  }
  const endAt = new Date(startAt.getTime() + lesson.service.duration * 60 * 1000);
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { startAt, endAt, status: "confirmed" },
  });
  return NextResponse.json({ ok: true });
}
