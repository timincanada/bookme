const MIC_IOS_CHROME =
  "Microphone blocked — allow it in Settings › Chrome › Microphone, then try again.";
const MIC_IOS_FIREFOX =
  "Microphone blocked — allow it in Settings › Firefox › Microphone, then try again.";
const MIC_IOS_EDGE =
  "Microphone blocked — allow it in Settings › Edge › Microphone, then try again.";
const MIC_IOS_SAFARI =
  "Microphone blocked — allow it in Settings › Safari › Microphone (or aA › Website Settings), then try again.";
const MIC_ANDROID_CHROME =
  "Microphone blocked — tap the lock icon in the address bar › Permissions › Microphone › Allow, then try again.";
const MIC_DESKTOP_CHROMIUM =
  "Microphone blocked — click the site icon left of the address › Microphone › Allow, then try again.";
const MIC_DESKTOP_SAFARI =
  "Microphone blocked — open Safari › Settings for bookme.training › Microphone › Allow, then try again.";
const MIC_BLOCKED_FALLBACK =
  "Microphone blocked — allow microphone access in your browser settings, then try again.";
const MIC_MISSING = "No microphone found. Try typing instead.";
const MIC_BUSY = "Microphone is busy in another app. Close it and try again.";
const VOICE_GENERIC = "Voice unavailable — try typing.";

const PERMISSION_NAMES = new Set(["NotAllowedError", "SecurityError", "PermissionDeniedError"]);
const MISSING_NAMES = new Set(["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]);
const BUSY_NAMES = new Set(["NotReadableError", "TrackStartError", "AbortError"]);

type MicClientHints = {
  platform?: string;
  maxTouchPoints?: number;
};

function errorName(err: unknown): string {
  if (!err || typeof err !== "object" || !("name" in err)) return "";
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function navigatorMicClient(): { ua: string; platform: string; maxTouchPoints: number } {
  if (typeof navigator === "undefined") return { ua: "", platform: "", maxTouchPoints: 0 };
  return {
    ua: navigator.userAgent || "",
    platform: navigator.platform || "",
    maxTouchPoints: navigator.maxTouchPoints || 0,
  };
}

function isIosSafari(ua: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  const mac = ua.includes("Macintosh") || platform === "MacIntel";
  return mac && maxTouchPoints > 1;
}

function isAndroidChrome(ua: string): boolean {
  return (
    ua.includes("Android") &&
    ua.includes("Chrome/") &&
    !ua.includes("EdgA") &&
    !ua.includes("Firefox")
  );
}

function isDesktopChromium(ua: string): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/.test(ua)) return false;
  return ua.includes("Chrome/") || ua.includes("Edg/");
}

function isDesktopSafari(ua: string): boolean {
  return (
    ua.includes("Macintosh") &&
    ua.includes("Safari/") &&
    ua.includes("Version/") &&
    !ua.includes("Chrome/") &&
    !ua.includes("Chromium") &&
    !ua.includes("Edg")
  );
}

export function micBlockedMessage(ua?: string, hints?: MicClientHints): string {
  const nav = ua === undefined ? navigatorMicClient() : { ua: "", platform: "", maxTouchPoints: 0 };
  const agent = ua ?? nav.ua;
  const platform = hints?.platform ?? nav.platform;
  const maxTouchPoints = hints?.maxTouchPoints ?? nav.maxTouchPoints;

  if (agent.includes("CriOS")) return MIC_IOS_CHROME;
  if (agent.includes("FxiOS")) return MIC_IOS_FIREFOX;
  if (agent.includes("EdgiOS")) return MIC_IOS_EDGE;
  if (isIosSafari(agent, platform, maxTouchPoints)) return MIC_IOS_SAFARI;
  if (isAndroidChrome(agent)) return MIC_ANDROID_CHROME;
  if (isDesktopChromium(agent)) return MIC_DESKTOP_CHROMIUM;
  if (isDesktopSafari(agent)) return MIC_DESKTOP_SAFARI;
  return MIC_BLOCKED_FALLBACK;
}

export function isMicPermissionError(err: unknown): boolean {
  return PERMISSION_NAMES.has(errorName(err));
}

export function micErrorMessage(err: unknown, ua?: string): string {
  const name = errorName(err);
  if (PERMISSION_NAMES.has(name)) return micBlockedMessage(ua);
  if (MISSING_NAMES.has(name)) return MIC_MISSING;
  if (BUSY_NAMES.has(name)) return MIC_BUSY;
  return VOICE_GENERIC;
}

export function voiceUnavailableMessage(reason?: string): string {
  if (reason === "not_configured") return "Voice is unavailable right now — please type instead.";
  if (reason === "upstream") return "Voice service didn't respond. Try again or type.";
  return VOICE_GENERIC;
}
