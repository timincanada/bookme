export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function looksLikeEmail(email: string) {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  return at > 0 && at < e.length - 1;
}
