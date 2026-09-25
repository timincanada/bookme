export const DEFAULT_TIMEZONE = "America/Toronto";

/** Common friendly labels for North American zones shown first in the picker. */
const FRIENDLY: Record<string, string> = {
  "America/Toronto": "Eastern Time",
  "America/New_York": "Eastern Time",
  "America/Indiana/Indianapolis": "Eastern Time — Indiana",
  "America/Halifax": "Atlantic Time",
  "America/St_Johns": "Newfoundland Time",
  "America/Winnipeg": "Central Time",
  "America/Chicago": "Central Time",
  "America/Edmonton": "Mountain Time",
  "America/Denver": "Mountain Time",
  "America/Vancouver": "Pacific Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Phoenix": "Mountain Time — Arizona",
  "America/Whitehorse": "Yukon Time",
  "America/Regina": "Central Time — Saskatchewan",
  "UTC": "UTC",
  "Europe/London": "UK Time",
  "Europe/Paris": "Central European Time",
  "Asia/Shanghai": "China Time",
  "Asia/Tokyo": "Japan Time",
  "Australia/Sydney": "Australian Eastern Time",
};

const PRIORITY = [
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
];

let cachedZones: string[] | null = null;

export function listIanaTimezones(): string[] {
  if (cachedZones) return cachedZones;
  const all =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone")
      : [];
  const set = new Set(all.length ? all : PRIORITY);
  for (const z of PRIORITY) set.add(z);
  cachedZones = [...set].sort((a, b) => {
    const ia = PRIORITY.indexOf(a);
    const ib = PRIORITY.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b);
  });
  return cachedZones;
}

export function isValidTimezone(tz: string | null | undefined): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
  } catch {
    return false;
  }
  // Prefer allowlist when available; still accept any IANA string Intl accepts.
  const list = listIanaTimezones();
  if (list.includes(tz)) return true;
  // Intl accepted it — treat as valid even if not in cached list (edge platforms).
  return true;
}

export function timezoneFriendlyName(tz: string): string {
  if (FRIENDLY[tz]) return FRIENDLY[tz];
  const leaf = tz.split("/").pop() || tz;
  return leaf.replace(/_/g, " ");
}

export function timezoneUtcHint(tz: string, at = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const off = parts.find((p) => p.type === "timeZoneName")?.value || "";
    return off.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

export function timezoneLabel(tz: string): { title: string; subtitle: string } {
  const title = timezoneFriendlyName(tz);
  const hint = timezoneUtcHint(tz);
  return {
    title,
    subtitle: hint ? `${tz} · ${hint}` : tz,
  };
}

/** Search IANA zones by friendly name or id. */
export function searchTimezones(query: string, limit = 12): string[] {
  const q = query.trim().toLowerCase();
  const all = listIanaTimezones();
  if (!q) return all.slice(0, limit);
  return all
    .filter((tz) => {
      const friendly = timezoneFriendlyName(tz).toLowerCase();
      return tz.toLowerCase().includes(q) || friendly.includes(q);
    })
    .slice(0, limit);
}

/** Next combobox highlight. Empty lists stay at -1. Out-of-range starts at an end. Wraps. */
export function nextHighlightIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return -1;
  const step = delta < 0 ? -1 : 1;
  if (!Number.isInteger(current) || current < 0 || current >= length) {
    return step > 0 ? 0 : length - 1;
  }
  return (current + step + length) % length;
}
