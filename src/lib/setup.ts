
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

export function canCopyBookingLink(setupComplete: boolean, _subscriptionStatus?: string | null, _trialEndsAt?: Date | string | null) {
  return setupComplete;
}
