import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasCapability, planCapabilities } from "@/lib/subscription";
import { parseAssistant, type AssistantAction } from "@/lib/assistant";
import { openSlots } from "@/lib/slots";
import { formatTime, formatWhen, torontoDateKey } from "@/lib/time";
import { canMoveLesson, statusAfterReschedule } from "@/lib/hold";
import { changeMails, sendMail, studentMessageMail } from "@/lib/mail";
import { getStripe } from "@/lib/stripe";

function upgradeResponse() {
  return NextResponse.json({ error: "Assistant is on Coach and Busy. Upgrade to use it.", upgrade: true }, { status: 403 });
}

async function contextFor(coachId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { coachId, status: { in: ["confirmed", "held"] } },
    include: { client: true, service: true },
    orderBy: { startAt: "asc" },
  });
  const clients = new Map();
  for (const l of lessons) clients.set(l.client.id, { id: l.client.id, name: l.client.name });
  return {
    todayKey: torontoDateKey(),
    clients: [...clients.values()],
    lessons: lessons.map((l) => ({ id: l.id, clientId: l.clientId, clientName: l.client.name, startAt: l.startAt.toISOString(), status: l.status })),
    raw: lessons,
  };
}

async function runAction(coach: { id: string; name: string; email: string; plan: string }, action: AssistantAction) {
  if (action.type === "list_availability") {
    if (!hasCapability(coach.plan, "list_availability")) return { error: "Missing capability", status: 403 };
    const me = await prisma.coach.findUnique({ where: { id: coach.id }, include: { services: true } });
    const duration = me?.services[0]?.duration || 60;
    const slots = await openSlots(coach.id, action.dateKey, duration);
    const lines = slots.map((s) => formatTime(new Date(s)));
    const text = lines.length ? ("Open " + action.dateKey + ": " + lines.join(", ")) : ("No open times on " + action.dateKey + ".");
    return { text, result: { dateKey: action.dateKey, slots } };
  }

  if (action.type === "message_student") {
    if (!hasCapability(coach.plan, "message_student")) return { error: "Missing capability", status: 403 };
    const hit = await prisma.lesson.findFirst({ where: { coachId: coach.id, clientId: action.clientId }, include: { client: true } });
    if (!hit) return { error: "Student not found", status: 404 };
    await sendMail(studentMessageMail({ studentEmail: hit.client.email, studentName: hit.client.name, coachName: coach.name, body: action.body }));
    return { text: "Emailed " + hit.client.name + " through BookMe." };
  }

  if (action.type === "mutate_schedule") {
    if (!hasCapability(coach.plan, "mutate_schedule")) return { error: "Missing capability", status: 403 };
    const lesson = await prisma.lesson.findUnique({ where: { id: action.lessonId }, include: { client: true, service: true, payment: true, coach: true } });
    if (!lesson || lesson.coachId !== coach.id) return { error: "Lesson not found", status: 404 };
    if (action.op === "cancel") {
      if (lesson.status === "cancelled") return { error: "Already cancelled", status: 400 };
      if (lesson.payment?.method === "card" && lesson.payment.status === "paid") {
        const stripe = getStripe();
        if (stripe && lesson.payment.stripePaymentIntentId) {
          await stripe.refunds.create({ payment_intent: lesson.payment.stripePaymentIntentId });
        }
        await prisma.payment.update({ where: { lessonId: lesson.id }, data: { status: "refunded" } });
      }
      await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "cancelled" } });
      for (const mail of changeMails({ kind: "cancelled", coachName: lesson.coach.name, coachEmail: lesson.coach.email, studentName: lesson.client.name, studentEmail: lesson.client.email, when: formatWhen(lesson.startAt) })) {
        await sendMail(mail);
      }
      return { text: "Cancelled the lesson with " + lesson.client.name + "." };
    }
    if (!action.start) return { error: "Missing new time", status: 400 };
    if (!canMoveLesson(lesson.status)) return { error: "That lesson cannot be moved", status: 400 };
    const startAt = new Date(action.start);
    const dateKey = startAt.toISOString().slice(0, 10);
    const slots = await openSlots(lesson.coachId, dateKey, lesson.service.duration);
    if (!slots.includes(startAt.toISOString())) return { error: "That time is not open", status: 409 };
    const endAt = new Date(startAt.getTime() + lesson.service.duration * 60 * 1000);
    const when = formatWhen(lesson.startAt);
    await prisma.lesson.update({ where: { id: lesson.id }, data: { startAt, endAt, status: statusAfterReschedule(lesson.status), reminded24h: false, reminded2h: false } });
    for (const mail of changeMails({ kind: "rescheduled", coachName: lesson.coach.name, coachEmail: lesson.coach.email, studentName: lesson.client.name, studentEmail: lesson.client.email, when, nextWhen: formatWhen(startAt) })) {
      await sendMail(mail);
    }
    return { text: "Moved the lesson with " + lesson.client.name + " to " + formatWhen(startAt) + "." };
  }

  return { error: "Unknown action", status: 400 };
}

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const caps = planCapabilities(coach.plan);
  if (caps.length === 0) return upgradeResponse();
  const body = await req.json();

  if (body.confirm && body.action) {
    const ran = await runAction(coach, body.action as AssistantAction);
    if ("error" in ran && ran.error) return NextResponse.json({ error: ran.error }, { status: ran.status || 400 });
    return NextResponse.json({ ok: true, text: ran.text, result: "result" in ran ? ran.result : undefined });
  }

  const ctx = await contextFor(coach.id);
  const parsed = parseAssistant(String(body.text || ""), { todayKey: ctx.todayKey, clients: ctx.clients, lessons: ctx.lessons });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!hasCapability(coach.plan, parsed.action.type === "mutate_schedule" ? "mutate_schedule" : parsed.action.type)) {
    return upgradeResponse();
  }
  if (!parsed.needsConfirm) {
    const ran = await runAction(coach, parsed.action);
    if ("error" in ran && ran.error) return NextResponse.json({ error: ran.error }, { status: ran.status || 400 });
    return NextResponse.json({ ok: true, text: ran.text, result: "result" in ran ? ran.result : undefined, action: parsed.action });
  }
  return NextResponse.json({ ok: true, needsConfirm: true, summary: parsed.summary, action: parsed.action });
}
