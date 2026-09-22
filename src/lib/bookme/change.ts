export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function nextWeekStart(startAt: Date) {
  return new Date(startAt.getTime() + WEEK_MS);
}

export function coachCancelRefundsCard(actor: "coach" | "student", selfServeWindow: boolean) {
  if (actor === "coach") return true;
  return selfServeWindow;
}
