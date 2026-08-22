export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function nextWeekStart(startAt: Date) {
  return new Date(startAt.getTime() + WEEK_MS);
}

/** Coach-initiated cancel of a card lesson always refunds. Student <24h does not. */
export function coachCancelRefundsCard(actor: "coach" | "student", selfServeWindow: boolean) {
  if (actor === "coach") return true;
  return selfServeWindow;
}
