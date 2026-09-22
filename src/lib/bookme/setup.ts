import { canPublish } from "./admin";

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

export function isSetupComplete(input: {
  title?: string | null;
  timezone?: string | null;
  service?: { duration: number; priceCad: number } | null;
  locationCount: number;
  hourCount: number;
}) {
  return Boolean(
    input.title &&
      input.timezone &&
      input.service &&
      input.service.duration > 0 &&
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
