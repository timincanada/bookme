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
  hasRecord: boolean;
  amountPaid?: number | null;
  currency?: string | null;
}) {
  if (!input.hasRecord || input.amountPaid == null || !input.currency) {
    return "Stripe：无账单记录";
  }
  const amount = (input.amountPaid / 100).toFixed(2);
  const currency = String(input.currency).toLowerCase();
  const prefix = CURRENCY_PREFIX[currency];
  return prefix ? `${prefix}${amount}` : `${currency.toUpperCase()} ${amount}`;
}
