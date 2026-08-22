import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { DURATIONS, VERTICALS } from "@/lib/setup";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { name, title, city, timezone, duration, priceCad } = await req.json();
  if (!(VERTICALS as readonly string[]).includes(title)) {
    return NextResponse.json({ error: "Pick a vertical" }, { status: 400 });
  }
  const mins = Number(duration);
  if (!(DURATIONS as readonly number[]).includes(mins)) {
    return NextResponse.json({ error: "Duration must be 30, 45, 60, or 90" }, { status: 400 });
  }
  const price = Number(priceCad);
  if (!price || price < 1) return NextResponse.json({ error: "Price is required" }, { status: 400 });

  await prisma.coach.update({
    where: { id: coach.id },
    data: {
      name: name || coach.name,
      title,
      city: city ?? coach.city,
      timezone: timezone || "America/Toronto",
    },
  });
  const existing = coach.services[0];
  if (existing) {
    await prisma.service.update({
      where: { id: existing.id },
      data: { name: `Private ${title.toLowerCase()}`, duration: mins, priceCad: price },
    });
  } else {
    await prisma.service.create({
      data: {
        coachId: coach.id,
        name: `Private ${title.toLowerCase()}`,
        duration: mins,
        priceCad: price,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
