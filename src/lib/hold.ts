export const HOLD_MS = 15 * 60 * 1000;

export function holdExpiresAt(from = new Date()) {
  return new Date(from.getTime() + HOLD_MS);
}

export function isHoldOpen(holdUntil: Date | null | undefined, now = new Date()) {
  return !!holdUntil && holdUntil.getTime() > now.getTime();
}
