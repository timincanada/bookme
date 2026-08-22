export const HOLD_MS = 15 * 60 * 1000;
export const SELF_RESCHEDULE_MS = 24 * 60 * 60 * 1000;

export function holdExpiresAt(from = new Date()) {
  return new Date(from.getTime() + HOLD_MS);
}

export function isHoldOpen(holdUntil: Date | null | undefined, now = new Date()) {
  return !!holdUntil && holdUntil.getTime() > now.getTime();
}

/** Card payment may confirm only while the 15-minute hold is still open. */
export function canConfirmCheckout(
  status: string,
  holdUntil: Date | null | undefined,
  now = new Date(),
) {
  return status === "held" && isHoldOpen(holdUntil, now);
}

/** Self-serve reschedule/refund is allowed at exactly 24h and beyond. */
export function canSelfReschedule(startAt: Date, now = new Date()) {
  return startAt.getTime() - now.getTime() >= SELF_RESCHEDULE_MS;
}

/** Moving a slot never confirms an unpaid card hold. */
export function statusAfterReschedule(status: string) {
  if (status === "held") return "held";
  if (status === "confirmed") return "confirmed";
  return status;
}

export function canMoveLesson(status: string) {
  return status === "confirmed" || status === "held";
}
