import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { changeMails, sendMail } from "@/lib/mail";
import { formatWhen } from "@/lib/time";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { lessonId } = await req.json();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { client: true, location: true, payment: true, coach: true },
  });
  if (!lesson || lesson.coachId !== coach.id) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (lesson.status === "cancelled") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }
  if (lesson.payment?.method === "card" && lesson.payment.status === "paid") {
    const stripe = getStripe();
    if (stripe && lesson.payment.stripePaymentIntentId) {
      await stripe.refunds.create({ payment_intent: lesson.payment.stripePaymentIntentId });
    }
    await prisma.payment.update({ where: { lessonId }, data: { status: "refunded" } });
  }
  await prisma.lesson.update({ where: { id: lessonId }, data: { status: "cancelled" } });
  for (const mail of changeMails({
    kind: "cancelled",
    coachName: lesson.coach.name,
    coachEmail: lesson.coach.email,
    studentName: lesson.client.name,
    studentEmail: lesson.client.email,
    when: formatWhen(lesson.startAt),
  })) {
    await sendMail(mail);
  }
  return NextResponse.json({ ok: true });
}
