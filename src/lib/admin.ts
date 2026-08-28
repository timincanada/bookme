import { canAcceptNewBookings, effectiveSubscriptionStatus } from "./subscription";

export const ADMIN_EMAIL = "zhouxiyin1024@gmail.com";
export const NO_ACCESS_COPY = "You don't have access";

export function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export function isAdminEmail(email?: string | null) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

/** Staff emails are never coaches in the staff console. Default is the first staff email. */
export function isStaffEmail(email?: string | null, staffEmails: string[] = [ADMIN_EMAIL]) {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  return staffEmails.some((e) => normalizeEmail(e) === needle);
}

export function visibleCoaches<T extends { email: string }>(coaches: T[], staffEmails: string[] = [ADMIN_EMAIL]) {
  return coaches.filter((c) => !isStaffEmail(c.email, staffEmails));
}

/** 401 if the staff cookie is missing; 403 if the id is not a Staff row. Never uses coach email. */
export function staffAuthStatus(sessionId: string | null | undefined, staffFound: boolean) {
  if (!sessionId) return 401;
  if (!staffFound) return 403;
  return 200;
}

/** /admin: coach session always 403 (no Staff login form). /app/admin is always 403. */
export function staffAdminView(coachSignedIn: boolean, staffSignedIn: boolean): "403" | "login" | "list" {
  if (coachSignedIn) return "403";
  if (staffSignedIn) return "list";
  return "login";
}

export function appAdminView(): "403" {
  return "403";
}

export type CoachStatRow = {
  email: string;
  banned?: boolean;
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
};

/** Registered = non-staff coaches. Trialing/active skip banned and skip staff emails. */
export function coachStats(coaches: CoachStatRow[], staffEmails: string[] = [ADMIN_EMAIL], now = new Date()) {
  const visible = visibleCoaches(coaches, staffEmails);
  const registeredCoaches = visible.length;
  const countable = visible.filter((c) => !c.banned);
  const onTrial = countable.filter(
    (c) => effectiveSubscriptionStatus(c.subscriptionStatus, c.trialEndsAt, now) === "trialing",
  ).length;
  const subscribed = countable.filter(
    (c) => effectiveSubscriptionStatus(c.subscriptionStatus, c.trialEndsAt, now) === "active",
  ).length;
  return {
    registeredCoaches,
    onTrial,
    subscribed,
    conversionLabel: conversionLabel(subscribed, registeredCoaches),
  };
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
    return "No Stripe record";
  }
  const amount = (input.amountPaid / 100).toFixed(2);
  const currency = String(input.currency).toLowerCase();
  const prefix = CURRENCY_PREFIX[currency];
  return prefix ? `${prefix}${amount}` : `${currency.toUpperCase()} ${amount}`;
}

export function conversionLabel(active: number, registered: number) {
  if (!registered) return "—";
  const pct = Math.round((active / registered) * 100);
  return `${pct}% (${active} active ÷ ${registered} registered coaches)`;
}

export function grantLabel(grant?: string | null) {
  if (grant === "paid") return "Grant: paid";
  if (grant === "unpaid") return "Grant: unpaid";
  return "Grant: none";
}

export function planAfterPaidGrant(plan?: string | null) {
  if (plan === "coach" || plan === "busy") return plan;
  return "light";
}

export function formatStatusLabel(
  status?: string | null,
  trialEndsAt?: Date | string | null,
  stripeRaw?: string | null,
) {
  const mapped = effectiveSubscriptionStatus(status, trialEndsAt);
  if (stripeRaw && stripeRaw !== mapped) return `${mapped} (Stripe: ${stripeRaw})`;
  return mapped;
}

/** Banned blocks; unpaid grant blocks; paid grant needs setup only; else Stripe trialing|active + setup. */
export function canPublish(opts: {
  setup: boolean;
  status?: string | null;
  trialEndsAt?: Date | string | null;
  banned?: boolean;
  accessGrant?: string | null;
}) {
  if (opts.banned) return false;
  if (opts.accessGrant === "unpaid") return false;
  if (!opts.setup) return false;
  if (opts.accessGrant === "paid") return true;
  return canAcceptNewBookings(opts.status, opts.trialEndsAt);
}
