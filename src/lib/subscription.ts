export const TRIAL_DAYS = 3;

export const PLANS = {
  light: { id: "light", name: "Light", cad: 19, max: 20 },
  coach: { id: "coach", name: "Coach", cad: 29, max: 60 },
  busy: { id: "busy", name: "Busy", cad: 49, max: Infinity },
} as const;

export type PlanId = keyof typeof PLANS;

const OPEN = new Set(["trialing", "active"]);

export function canAcceptNewBookings(status: string | null | undefined) {
  return OPEN.has(status || "none");
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
