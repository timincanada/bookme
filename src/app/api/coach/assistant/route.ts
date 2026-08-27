import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasCapability, planCapabilities, type Capability } from "@/lib/subscription";
import { expireStaleTrial } from "@/lib/subscription-sync";
import { shiftDateKey, type AssistantAction } from "@/lib/assistant";
import { assistantProvider } from "@/lib/assistant-provider";
import { openSlots } from "@/lib/slots";
import { formatTime, formatWhen, torontoDateKey } from "@/lib/time";
import { canMoveLesson, statusAfterReschedule } from "@/lib/hold";
import { changeMails, sendMail, studentMessageMail } from "@/lib/mail";

function upgradeResponse() {
  return NextResponse.json({ error: "Assistant is on Coach", upgrade: true }, { status: 403 });
}

function capFor(action: AssistantAction): Capability {
  if (action.type === "list_availability") return "list_availability";
  if (action.type === "draft_email") return "draft_email";
  return "draft_reschedule";
}

function clock(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "p.m." : "a.m.";
  const hr = ((h + 11) % 12) + 1;
  return hr + ":" + String(m).padStart(2, "0") + " " + ap;
}

async function runAction(coach: { id: string; name: string; email: string; plan: string; subscriptionStatus: string; trialEndsAt: Date | null }, action: AssistantAction) {
  const status = coach.subscriptionStatus;
  if (action.type === "list_availability") {
    if (!hasCapability(coach.plan, "list_availability", status, coach.trialEndsAt)) return { error: "Missing capability", status: 403 };
    const me = await prisma.coach.findUnique({ where: { id: coach.id }, include: { services: true, locations: { where: { active: true } } } });
    const duration = me?.services[0]?.duration || 60;
    const locName = (me?.locations.find((l) => l.kind !== "online") || me?.locations[0])?.name || "";
    const days = action.days || 1;
    const groups: { dateKey: string; label: string; lines: string[] }[] = [];
    for (let i = 0; i < days; i++) {
      const dateKey = shiftDateKey(action.dateKey, i);
      const slots = await openSlots(coach.id, dateKey, duration);
      if (!slots.length && days > 1) continue;
      const label = new Date(dateKey + "T12:00:00-04:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" });
      groups.push({ dateKey, label, lines: slots.map((s) => formatTime(new Date(s)) + (locName ? " · " + locName : "")) });
    }
    const preview = { kind: "openings", heading: "", footer: "Openings only. Nothing was changed.", groups };
    const text = groups.length ? groups.map((g) => g.label + (g.lines.length ? ": " + g.lines.join(", ") : ": none")).join(" / ") : "No open times.";
    return { text, preview };
  }

  if (action.type === "draft_email") {
    if (!hasCapability(coach.plan, "draft_email", status, coach.trialEndsAt)) return { error: "Missing capability", status: 403 };
    const lesson = await prisma.lesson.findUnique({ where: { id: action.lessonId }, include: { client: true, location: true } });
    if (!lesson || lesson.coachId !== coach.id) return { error: "That lesson is not yours.", status: 404 };
    await sendMail(studentMessageMail({ studentEmail: lesson.client.email, studentName: lesson.client.name, coachName: coach.name, body: action.body }));
    return { text: "Email sent to " + lesson.client.name + "." };
  }

  if (action.type === "draft_reschedule" && action.op === "block") {
    if (!hasCapability(coach.plan, "draft_reschedule", status, coach.trialEndsAt)) return { error: "Missing capability", status: 403 };
    const data = { coachId: coach.id, date: action.dateKey, startMin: action.startMin, endMin: action.endMin };
    const existing = await prisma.dateBlock.findFirst({ where: { coachId: coach.id, date: action.dateKey } });
    if (existing) await prisma.dateBlock.update({ where: { id: existing.id }, data: { startMin: data.startMin, endMin: data.endMin } });
    else await prisma.dateBlock.create({ data });
    return { text: "Blocked openings on " + action.dateKey + ". Existing lessons stay." };
  }

  if (action.type === "draft_reschedule" && action.op === "move") {
    if (!hasCapability(coach.plan, "draft_reschedule", status, coach.trialEndsAt)) return { error: "Missing capability", status: 403 };
    const lesson = await prisma.lesson.findUnique({ where: { id: action.lessonId }, include: { client: true, service: true, coach: true } });
    if (!lesson || lesson.coachId !== coach.id) return { error: "Lesson not found", status: 404 };
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

async function previewFor(coachId: string, coachName: string, action: AssistantAction) {
  if (action.type === "draft_email") {
    const lesson = await prisma.lesson.findUnique({ where: { id: action.lessonId }, include: { client: true, location: true } });
    if (!lesson || lesson.coachId !== coachId) return null;
    return {
      kind: "email",
      heading: "Preview · Send email",
      fields: [
        { label: "To", value: lesson.client.name },
        { label: "About", value: formatWhen(lesson.startAt) + " at " + lesson.location.name },
        { label: "Draft", value: action.body },
      ],
      confirmLabel: "Send email",
      cancelLabel: "Don\x27t send",
    };
  }
  if (action.type === "draft_reschedule" && action.op === "block") {
    const label = new Date(action.dateKey + "T12:00:00-04:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" });
    return {
      kind: "hours",
      heading: "Preview · Change hours",
      fields: [{ label: "", value: label + " · " + clock(action.startMin) + "–" + clock(action.endMin) }],
      note: "Will be blocked. Existing lessons that day stay.",
      footer: "Nothing applied until Confirm.",
      confirmLabel: "Confirm change",
      cancelLabel: "Keep hours",
    };
  }
  if (action.type === "draft_reschedule" && action.op === "move") {
    const lesson = await prisma.lesson.findUnique({ where: { id: action.lessonId }, include: { client: true, location: true } });
    if (!lesson || lesson.coachId !== coachId) return null;
    return {
      kind: "move",
      heading: "Preview · Reschedule",
      fields: [
        { label: "Student", value: lesson.client.name },
        { label: "From", value: formatWhen(lesson.startAt) },
        { label: "To", value: formatWhen(new Date(action.start)) },
      ],
      footer: "Same price. Confirm to apply and email the student.",
      confirmLabel: "Confirm change",
      cancelLabel: "Keep lesson",
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const raw = await currentCoach();
  if (!raw) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const coach = await expireStaleTrial(raw);
  const caps = planCapabilities(coach.plan, coach.subscriptionStatus, coach.trialEndsAt);
  if (caps.length === 0) return upgradeResponse();
  const body = await req.json();

  if (body.confirm && body.action) {
    if (!hasCapability(coach.plan, capFor(body.action), coach.subscriptionStatus, coach.trialEndsAt)) return upgradeResponse();
    const ran = await runAction(coach, body.action as AssistantAction);
    if ("error" in ran && ran.error) return NextResponse.json({ error: ran.error }, { status: ran.status || 400 });
    return NextResponse.json({ ok: true, text: ran.text, preview: "preview" in ran ? ran.preview : undefined });
  }

  const lessons = await prisma.lesson.findMany({ where: { coachId: coach.id, status: { in: ["confirmed", "held"] } }, include: { client: true, location: true }, orderBy: { startAt: "asc" } });
  const clients = new Map();
  for (const l of lessons) clients.set(l.client.id, { id: l.client.id, name: l.client.name });
  const parsed = assistantProvider.parse(String(body.text || ""), {
    todayKey: torontoDateKey(),
    clients: [...clients.values()],
    lessons: lessons.map((l) => ({ id: l.id, clientId: l.clientId, clientName: l.client.name, startAt: l.startAt.toISOString(), status: l.status, location: l.location.name })),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!hasCapability(coach.plan, capFor(parsed.action), coach.subscriptionStatus, coach.trialEndsAt)) return upgradeResponse();
  if (!parsed.needsConfirm) {
    const ran = await runAction(coach, parsed.action);
    if ("error" in ran && ran.error) return NextResponse.json({ error: ran.error }, { status: ran.status || 400 });
    return NextResponse.json({ ok: true, text: ran.text, preview: "preview" in ran ? ran.preview : undefined, action: parsed.action });
  }
  const preview = await previewFor(coach.id, coach.name, parsed.action);
  return NextResponse.json({ ok: true, needsConfirm: true, summary: parsed.summary, action: parsed.action, preview });
}
