export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

/** Product: must contain @. Blocks values like 1111 before Stripe. */
export function looksLikeEmail(email: string) {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  return at > 0 && at < e.length - 1;
}
