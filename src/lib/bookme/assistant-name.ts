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

/** Chat header title: "{CoachName}'s Private Assistant". Prefer Name's even when the name ends in s. */
export function assistantDeskTitle(coachName: string) {
  const n = String(coachName ?? "").trim();
  if (!n) return "BookMe Assistant";
  return `${n}'s Private Assistant`;
}

