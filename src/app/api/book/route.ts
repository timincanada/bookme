import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";
import { notifyLessonConfirmed } from "@/lib/mail-send";
import { pickLocation } from "@/lib/location";
import { looksLikeEmail, normalizeEmail } from "@/lib/email";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, start, name, locationId } = body;
  const email = normalizeEmail(body.email);
  if (!slug || !start || !name || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  const coach = await prisma.coach.findUnique({
    where: { slug },
    include: { services: true, locations: { where: { active: true } }, hours: true },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  const service = coach.services[0];
  if (!service) return NextResponse.json({ error: "Coach is not set up" }, { status: 400 });
  const picked = pickLocation(coach.locations, locationId);
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 });
  const location = picked.location;
  const setup = isSetupComplete({
    title: coach.title,
    timezone: coach.timezone,
    service,
    locationCount: coach.locations.length,
    hourCount: coach.hours.length,
  });
  if (!canCopyBookingLink(setup, coach.subscriptionStatus, coach.trialEndsAt, coach.banned, coach.accessGrant)) {
    return NextResponse.json({ error: "This coach is not accepting new bookings" }, { status: 403 });
  }

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
  const lesson = await prisma.lesson.create({
    data: {
      coachId: coach.id,
      serviceId: service.id,
      locationId: location.id,
      clientId: client.id,
      startAt,
      endAt,
      status: "confirmed",
    },
  });
  await notifyLessonConfirmed(lesson.id);
  return NextResponse.json({ id: lesson.id });
}
