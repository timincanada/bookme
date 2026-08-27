export type PayMethod = "card" | "cash";

export const PLATFORM_FEE_RATE = 0.05;

export function platformFeeCents(priceCad: number) {
  return Math.round(priceCad * 100 * PLATFORM_FEE_RATE);
}

export function canTakeCard(acceptCard: boolean, stripeAccountId?: string | null) {
  return !!acceptCard && !!stripeAccountId;
}

export function connectPaymentIntentData(stripeAccountId: string, priceCad: number) {
  return {
    application_fee_amount: platformFeeCents(priceCad),
    transfer_data: { destination: stripeAccountId },
  };
}

export function enabledMethods(acceptCard: boolean, acceptCash: boolean, stripeAccountId?: string | null): PayMethod[] {
  const out: PayMethod[] = [];
  if (canTakeCard(acceptCard, stripeAccountId)) out.push("card");
  if (acceptCash) out.push("cash");
  return out;
}

export function canUseMethod(method: string, acceptCard: boolean, acceptCash: boolean, stripeAccountId?: string | null) {
  if (method === "card") return canTakeCard(acceptCard, stripeAccountId);
  if (method === "cash") return acceptCash;
  return false;
}

/** At least one method must stay on. Turning both off is rejected. */
export function normalizeAccepted(acceptCard: boolean, acceptCash: boolean) {
  if (!acceptCard && !acceptCash) return null;
  return { acceptCard, acceptCash };
}
