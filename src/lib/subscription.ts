export const COACH_PLAN_CAD = 29;
export const TRIAL_DAYS = 3;

const OPEN = new Set(["trialing", "active"]);

export function canAcceptNewBookings(status: string | null | undefined) {
  return OPEN.has(status || "none");
}

export function isSubscribed(status: string | null | undefined) {
  return canAcceptNewBookings(status);
}
