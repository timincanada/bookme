import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/slots";

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
          method: cash ? "cash" : "card",
          status: cash ? "unpaid" : "paid",
          amountCad: service.priceCad,
        },
      },
    },
  });
  return NextResponse.json({ id: lesson.id });
}
