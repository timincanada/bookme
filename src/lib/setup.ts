import { canPublish } from "./admin";

export const VERTICALS = [
  "Tennis",
  "Soccer",
  "Golf",
  "Fitness",
  "Swimming",
  "Music",
  "Tutor",
  "Pickleball",
  "Badminton",
  "Yoga",
] as const;

export const DURATIONS = [30, 45, 60, 90] as const;

export function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "coach";
}

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

/** Booking link can be copied after setup AND trial/paid, or a paid grant. Banned / unpaid grant always block. */
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
    purpose: "copy",
  });
}
