export const DEFAULT_ASSISTANT_NAME = "Assistant";
export const ASSISTANT_NAME_MAX = 24;

export function normalizeAssistantName(value: unknown) {
  const raw = String(value ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return DEFAULT_ASSISTANT_NAME;
  return raw.slice(0, ASSISTANT_NAME_MAX).trim() || DEFAULT_ASSISTANT_NAME;
}

/** True when the coach set a custom nickname (not the default "Assistant"). */
export function hasCustomAssistantName(assistantName: string | null | undefined) {
  const n = normalizeAssistantName(assistantName);
  return n !== DEFAULT_ASSISTANT_NAME;
}

/**
 * Chat header title.
 * Custom name: "{assistantName}-{CoachName}'s Private Assistant" (e.g. Lucy-Alex Rivera's Private Assistant).
 * Default/empty assistant name: "{CoachName}'s Private Assistant".
 * Prefer Name's even when the coach name ends in s.
 */
export function assistantDeskTitle(coachName: string, assistantName?: string | null) {
  const coach = String(coachName ?? "").trim();
  if (!coach) return "BookMe Assistant";
  const desk = `${coach}'s Private Assistant`;
  if (!hasCustomAssistantName(assistantName)) return desk;
  // Use the saved Name as typed (after normalize), not Title Case forced on the nickname.
  return `${normalizeAssistantName(assistantName)}-${desk}`;
}
