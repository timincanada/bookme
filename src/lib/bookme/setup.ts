import { canPublish } from "./admin";
import { isLessonDuration, type LessonDuration } from "./recurring";

export { VERTICALS, sportFromTitle } from "./verticals";

export { LESSON_DURATIONS as DURATIONS } from "./recurring";

export function slugifyName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "coach";
}

export const slugify = slugifyName;


/** Unique sorted valid duration chips; null if none. At least one required by callers. */
export function normalizeServiceDurations(
  input: unknown,
  fallbackDuration?: unknown,
): LessonDuration[] | null {
  const raw: unknown[] = Array.isArray(input)
    ? input
    : input != null
      ? [input]
      : fallbackDuration != null
        ? [fallbackDuration]
        : [];
  const cleaned = [
    ...new Set(
      raw
        .map((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : Number(v)))
        .filter((n): n is LessonDuration => isLessonDuration(n)),
    ),
  ].sort((a, b) => a - b);
  return cleaned.length ? cleaned : null;
}

/** Resolve durations from a service row (array column or legacy single duration). */
export function durationsFromService(service: {
  duration?: number | null;
  durations?: number[] | null;
}): LessonDuration[] {
  return normalizeServiceDurations(service.durations, service.duration) ?? ([60] as LessonDuration[]);
}


export function isSetupComplete(input: {
  title?: string | null;
  timezone?: string | null;
  service?: { duration: number; priceCad: number; durations?: number[] | null } | null;
  locationCount: number;
  hourCount: number;
}) {
  const durations = input.service
    ? normalizeServiceDurations(input.service.durations, input.service.duration)
    : null;
  return Boolean(
    input.title &&
      input.timezone &&
      input.service &&
      durations &&
      durations.length > 0 &&
      input.service.priceCad > 0 &&
      input.locationCount > 0 &&
      input.hourCount > 0,
  );
}

export function canCopyBookingLink(
  setupComplete: boolean,
  subscriptionStatus: string | null | undefined,
  trialEndsAt?: Date | string | null,
  bannedOrExtra: boolean | { banned?: boolean; accessGrant?: string | null } = false,
  accessGrant = "",
) {
  let banned = false;
  let grant = accessGrant;
  if (typeof bannedOrExtra === "object" && bannedOrExtra) {
    banned = Boolean(bannedOrExtra.banned);
    if (bannedOrExtra.accessGrant != null) grant = bannedOrExtra.accessGrant;
  } else {
    banned = Boolean(bannedOrExtra);
  }
  return canPublish({
    setup: setupComplete,
    status: subscriptionStatus,
    trialEndsAt,
    banned,
    accessGrant: grant,
  });
}
