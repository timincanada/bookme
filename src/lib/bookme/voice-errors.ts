const MIC_BLOCKED = "Microphone blocked — allow it in Settings › Safari › Microphone, then try again.";
const MIC_MISSING = "No microphone found. Try typing instead.";
const MIC_BUSY = "Microphone is busy in another app. Close it and try again.";
const VOICE_GENERIC = "Voice unavailable — try typing.";

const PERMISSION_NAMES = new Set(["NotAllowedError", "SecurityError", "PermissionDeniedError"]);
const MISSING_NAMES = new Set(["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]);
const BUSY_NAMES = new Set(["NotReadableError", "TrackStartError", "AbortError"]);

function errorName(err: unknown): string {
  if (!err || typeof err !== "object" || !("name" in err)) return "";
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

export function isMicPermissionError(err: unknown): boolean {
  return PERMISSION_NAMES.has(errorName(err));
}

export function micErrorMessage(err: unknown): string {
  const name = errorName(err);
  if (PERMISSION_NAMES.has(name)) return MIC_BLOCKED;
  if (MISSING_NAMES.has(name)) return MIC_MISSING;
  if (BUSY_NAMES.has(name)) return MIC_BUSY;
  return VOICE_GENERIC;
}

export function voiceUnavailableMessage(reason?: string): string {
  if (reason === "not_configured") return "Voice is unavailable right now — please type instead.";
  if (reason === "upstream") return "Voice service didn't respond. Try again or type.";
  return VOICE_GENERIC;
}
