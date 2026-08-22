export type PayMethod = "card" | "cash";

export function enabledMethods(acceptCard: boolean, acceptCash: boolean): PayMethod[] {
  const out: PayMethod[] = [];
  if (acceptCard) out.push("card");
  if (acceptCash) out.push("cash");
  return out;
}

export function canUseMethod(method: string, acceptCard: boolean, acceptCash: boolean) {
  if (method === "card") return acceptCard;
  if (method === "cash") return acceptCash;
  return false;
}

/** At least one method must stay on. Turning both off is rejected. */
export function normalizeAccepted(acceptCard: boolean, acceptCash: boolean) {
  if (!acceptCard && !acceptCash) return null;
  return { acceptCard, acceptCash };
}
