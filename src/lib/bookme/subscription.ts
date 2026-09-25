import type { Capability } from "./assistant";

export type { Capability } from "./assistant";

export const TRIAL_DAYS = 3;

const ASSISTANT: Capability[] = [
  "list_availability",
  "list_lessons",
  "draft_email",
  "draft_reschedule",
  "draft_swap",
  "cancel_lesson",
];

export const PLANS = {
  light: { id: "light", name: "Light", cad: 19, max: 20, capabilities: [] as Capability[] },
  coach: { id: "coach", name: "Coach", cad: 29, max: 60, capabilities: ASSISTANT },
  busy: { id: "busy", name: "Busy", cad: 49, max: Infinity, capabilities: ASSISTANT },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPreferredPlan(plan: string | null | undefined): plan is PlanId {
  return plan === "light" || plan === "coach" || plan === "busy";
}

export function planLessonRange(plan: PlanId) {
  if (plan === "light") return "Up to 20 confirmed lessons / month";
  if (plan === "busy") return "61+ confirmed lessons / month";
  return "21–60 confirmed lessons / month";
}

export function isTrialing(status?: string | null, trialEndsAt?: Date | string | null, now = new Date()) {
  if (status !== "trialing") return false;
  if (!trialEndsAt) return true;
  const end = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  return end.getTime() > now.getTime();
}

export function effectiveSubscriptionStatus(
  status?: string | null,
  trialEndsAt?: Date | string | null,
  now = new Date(),
) {
  if (status === "trialing" && !isTrialing(status, trialEndsAt, now)) return "active";
  return status || "none";
}

export function planCapabilities(
  plan?: string | null,
  status?: string | null,
  trialEndsAt?: Date | string | null,
  now = new Date(),
): Capability[] {
  if (isTrialing(status, trialEndsAt, now)) return [...ASSISTANT];
  if (plan === "coach" || plan === "busy") return [...PLANS[plan].capabilities];
  return [];
}

export function hasCapability(
  plan: string | null | undefined,
  cap: Capability,
  status?: string | null,
  trialEndsAt?: Date | string | null,
) {
  return planCapabilities(plan, status, trialEndsAt).includes(cap);
}

const OPEN = new Set(["trialing", "active"]);

export function canAcceptNewBookings(status: string | null | undefined, trialEndsAt?: Date | string | null) {
  return OPEN.has(effectiveSubscriptionStatus(status, trialEndsAt));
}

export function isSubscribed(status: string | null | undefined) {
  return canAcceptNewBookings(status);
}

export function planForConfirmedCount(count: number): PlanId {
  if (count <= 20) return "light";
  if (count <= 60) return "coach";
  return "busy";
}

export function lastMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end };
}

export function priceIdForPlan(plan: PlanId) {
  const env =
    plan === "light"
      ? process.env.STRIPE_PRICE_LIGHT
      : plan === "coach"
        ? process.env.STRIPE_PRICE_COACH
        : process.env.STRIPE_PRICE_BUSY;
  return env || "";
}

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_LIGHT) return "light";
  if (priceId === process.env.STRIPE_PRICE_COACH) return "coach";
  if (priceId === process.env.STRIPE_PRICE_BUSY) return "busy";
  return null;
}

export function shouldPriceInvoiceFromLastMonth(opts: {
  billingReason?: string | null;
  invoiceStatus?: string | null;
  subscriptionStatus?: string | null;
  trialEnd?: Date | null;
  periodStart?: Date | null;
}) {
  if (opts.invoiceStatus && !["draft", "open"].includes(opts.invoiceStatus)) return false;
  if (opts.subscriptionStatus === "trialing") return false;
  if (opts.billingReason && opts.billingReason !== "subscription_cycle") return false;
  if (opts.trialEnd && opts.periodStart && opts.periodStart.getTime() <= opts.trialEnd.getTime() + 60_000) {
    return false;
  }
  return true;
}

/** Plain-language subscription status for the billing page. */
export function subscriptionStatusLabel(status: string | null | undefined, trialEndsAt?: string | null) {
  const trialDate = trialEndsAt ? trialEndsAt.slice(0, 10) : null;
  switch (String(status || "none")) {
    case "trialing":
      return trialDate ? `Free trial until ${trialDate}` : "Free trial";
    case "active":
      return "Active subscription";
    case "past_due":
      return "Payment failed — update your card";
    case "unpaid":
      return "Unpaid — subscription paused";
    case "canceled":
      return "Cancelled — no active subscription";
    default:
      return "No subscription yet";
  }
}

export function planTierLabel(status: string | null | undefined, plan: string | null | undefined) {
  const p = String(plan || "none");
  if (p === "none" || String(status || "none") === "none") {
    return "Start the trial to publish your booking page.";
  }
  const names: Record<string, string> = { light: "Light", coach: "Coach", busy: "Busy" };
  return `Tier: ${names[p] ?? p}`;
}
