export const TRIAL_DAYS = 3;

export type Capability = "list_availability" | "draft_email" | "draft_reschedule";

const ASSISTANT: Capability[] = ["list_availability", "draft_email", "draft_reschedule"];

export const PLANS = {
  light: { id: "light", name: "Light", cad: 19, max: 20, capabilities: [] as Capability[] },
  coach: { id: "coach", name: "Coach", cad: 29, max: 60, capabilities: ASSISTANT },
  busy: { id: "busy", name: "Busy", cad: 49, max: Infinity, capabilities: ASSISTANT },
} as const;

export type PlanId = keyof typeof PLANS;

export function isTrialing(status?: string | null, trialEndsAt?: Date | string | null, now = new Date()) {
  if (status !== "trialing") return false;
  if (!trialEndsAt) return true;
  const end = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  return end.getTime() > now.getTime();
}

export function effectiveSubscriptionStatus(status?: string | null, trialEndsAt?: Date | string | null, now = new Date()) {
  if (status === "trialing" && !isTrialing(status, trialEndsAt, now)) return "active";
  return status || "none";
}

export function planCapabilities(_plan?: string | null, _status?: string | null, _trialEndsAt?: Date | string | null, _now = new Date()): Capability[] {
  return [...ASSISTANT];
}

export function hasCapability(plan: string | null | undefined, cap: Capability, status?: string | null, trialEndsAt?: Date | string | null) {
  return planCapabilities(plan, status, trialEndsAt).includes(cap);
}


export function canAcceptNewBookings(_status?: string | null, _trialEndsAt?: Date | string | null) {
  return true;
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
