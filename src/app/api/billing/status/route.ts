import { NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";

export async function GET() {
  const coach = await currentCoach();
  if (!coach) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json({
    status: coach.subscriptionStatus,
    plan: coach.plan,
    trialEndsAt: coach.trialEndsAt,
  });
}
