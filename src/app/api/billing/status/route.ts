import { NextResponse } from "next/server";
import { currentCoach } from "@/lib/session";
import { expireStaleTrial } from "@/lib/subscription-sync";
import { effectiveSubscriptionStatus } from "@/lib/subscription";

export async function GET() {
  const raw = await currentCoach();
  if (!raw) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const coach = await expireStaleTrial(raw);
  return NextResponse.json({
    status: effectiveSubscriptionStatus(coach.subscriptionStatus, coach.trialEndsAt),
    plan: coach.plan,
    trialEndsAt: coach.trialEndsAt,
  });
}
