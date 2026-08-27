import { NextResponse } from "next/server";
import { currentCoach } from "./session";
import { effectiveSubscriptionStatus } from "./subscription";

export const ADMIN_EMAIL = "zhouxiyin1024@gmail.com";

export function isAdminEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function paidSubscription(status?: string | null, trialEndsAt?: Date | string | null, now = new Date()) {
  const effective = effectiveSubscriptionStatus(status, trialEndsAt, now);
  return effective === "trialing" || effective === "active";
}

export function formatPlanLabel(plan?: string | null) {
  if (plan === "light") return "Light";
  if (plan === "coach") return "Coach";
  if (plan === "busy") return "Busy";
  return "—";
}

const CURRENCY_PREFIX: Record<string, string> = {
  cad: "CA$",
  usd: "US$",
  gbp: "£",
  eur: "€",
};

export function stripeFeeLabel(input: {
  amountPaid?: number | null;
  currency?: string | null;
  hasRecord: boolean;
}) {
  if (!input.hasRecord) return "Stripe：无账单记录";
  const cents = input.amountPaid ?? 0;
  const currency = String(input.currency || "cad").toLowerCase();
  const amount = (cents / 100).toFixed(2);
  const prefix = CURRENCY_PREFIX[currency];
  return prefix ? `${prefix}${amount}` : `${currency.toUpperCase()} ${amount}`;
}

export async function requireAdmin() {
  const coach = await currentCoach();
  if (!coach) {
    return { ok: false as const, response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  if (!isAdminEmail(coach.email)) {
    return { ok: false as const, response: NextResponse.json({ error: "Not allowed" }, { status: 403 }) };
  }
  return { ok: true as const, coach };
}
