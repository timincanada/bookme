import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { clientId, note } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  const owned = await prisma.lesson.findFirst({ where: { coachId: coach.id, clientId } });
  if (!owned) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  await prisma.client.update({ where: { id: clientId }, data: { note: String(note || "") } });
  return NextResponse.json({ ok: true });
}
