import { NextRequest, NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { normalizeAccepted } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { acceptCard, acceptCash } = await req.json();
  if (acceptCard && !coach.stripeAccountId) {
    return NextResponse.json({ error: "Connect Stripe to take cards", needsConnect: true }, { status: 400 });
  }
  const next = normalizeAccepted(!!acceptCard, !!acceptCash);
  if (!next) {
    return NextResponse.json({ error: "Turn on at least one: card or cash" }, { status: 400 });
  }
  await prisma.coach.update({ where: { id: coach.id }, data: next });
  return NextResponse.json(next);
}
