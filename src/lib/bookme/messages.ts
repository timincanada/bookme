/**
 * Coach ↔ student messaging rules (pure).
 *
 * Eligibility: at least one confirmed/completed lesson between the coach and this
 * client record. Either side may send until 90 days after the last such lesson
 * ends; after that the thread is read-only. A banned or lapsed coach makes the
 * thread read-only for both sides and blocks new threads.
 */
export const MESSAGE_WINDOW_DAYS = 90;
export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGES_PER_MINUTE = 20;
export const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;
export const VALID_LESSON_STATUSES = ["confirmed", "completed"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MessageMode = "send" | "read" | "none";

export type ModeReason = "ok" | "no_lessons" | "window_closed" | "coach_inactive" | "no_email";

export function messageMode(input: {
  lastValidEnd: Date | null;
  hasConversation: boolean;
  coachActive: boolean;
  studentHasEmail: boolean;
  now: Date;
}): { mode: MessageMode; reason: ModeReason } {
  const readOrNone = (reason: ModeReason) => ({ mode: (input.hasConversation ? "read" : "none") as MessageMode, reason });
  if (!input.studentHasEmail) return readOrNone("no_email");
  if (!input.lastValidEnd) return readOrNone("no_lessons");
  if (!input.coachActive) return readOrNone("coach_inactive");
  const closes = input.lastValidEnd.getTime() + MESSAGE_WINDOW_DAYS * DAY_MS;
  if (input.now.getTime() > closes) return readOrNone("window_closed");
  return { mode: "send", reason: "ok" };
}

export const MODE_REASON_TEXT: Record<ModeReason, string> = {
  ok: "",
  no_lessons: "Messages open after a confirmed lesson.",
  window_closed: "This conversation closed 90 days after the last lesson. Book again to reopen it.",
  coach_inactive: "This coach isn't taking messages right now.",
  no_email: "This client has no email, so they can't use messages.",
};

export function cleanBody(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > MESSAGE_MAX_LENGTH) return { ok: false, error: `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.` };
  return { ok: true, body };
}

/**
 * Email the recipient about a new message? Not within the cooldown of the last
 * notice, and not if they opened the thread within the cooldown.
 */
export function shouldNotify(input: { lastReadAt: Date | null; notifiedAt: Date | null; now: Date }) {
  const since = input.now.getTime() - NOTIFY_COOLDOWN_MS;
  if (input.notifiedAt && input.notifiedAt.getTime() > since) return false;
  if (input.lastReadAt && input.lastReadAt.getTime() > since) return false;
  return true;
}
