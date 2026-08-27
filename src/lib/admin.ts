import { canAcceptNewBookings, effectiveSubscriptionStatus } from "./subscription";

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
  if (!input.hasRecord) return "Stripe：无账单记录";
  const cents = input.amountPaid ?? 0;
  const currency = String(input.currency || "cad").toLowerCase();
  const amount = (cents / 100).toFixed(2);
  const prefix = CURRENCY_PREFIX[currency];
  return prefix ? `${prefix}${amount}` : `${currency.toUpperCase()} ${amount}`;
}

export function conversionLabel(active: number, registered: number) {
  if (!registered) return "0% (0 active / 0 registered)";
  const pct = Math.round((active / registered) * 100);
  return `${pct}% (${active} active / ${registered} registered)`;
}

export function grantLabel(grant?: string | null) {
  if (grant === "paid") return "Grant: paid";
  if (grant === "unpaid") return "Grant: unpaid";
  return "Grant: none";
}

const KNOWN_STATUS = new Set(["none", "trialing", "active", "canceled"]);

export function formatStatusLabel(
  status?: string | null,
  trialEndsAt?: Date | string | null,
  stripeRaw?: string | null,
) {
  const mapped = effectiveSubscriptionStatus(status, trialEndsAt);
  const raw = stripeRaw || status || "none";
  const shown = KNOWN_STATUS.has(mapped) ? mapped : "active";
  if (raw !== shown) return `${shown} (Stripe: ${raw})`;
  return shown;
}

export type PublishPurpose = "copy" | "accept";

export function canPublish(opts: {
  setup: boolean;
  status?: string | null;
  trialEndsAt?: Date | string | null;
  banned?: boolean;
  accessGrant?: string | null;
  purpose?: PublishPurpose;
}) {
  if (opts.banned) return false;
  const grant = opts.accessGrant || "";
  if (grant === "unpaid") return false;
  const purpose = opts.purpose ?? "copy";
  if (grant === "paid") {
    return purpose === "accept" ? true : Boolean(opts.setup);
  }
  const open = canAcceptNewBookings(opts.status, opts.trialEndsAt);
  return purpose === "accept" ? open : Boolean(opts.setup) && open;
}
