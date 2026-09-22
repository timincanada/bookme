export const BOOKING_HOST = "bookme.training";
export const MANAGE_PATH = "/manage";

export const RESERVED_SLUGS = new Set([
  "about",
  "admin",
  "api",
  "app",
  "assets",
  "assistant",
  "auth",
  "billing",
  "blog",
  "book",
  "bookings",
  "c",
  "clients",
  "coach",
  "coaches",
  "confirmed",
  "welcome",
  "delete-account",
  "s",
  "contact",
  "docs",
  "favicon",
  "find",
  "for-clubs",
  "for-coaches",
  "help",
  "how-it-works",
  "index",
  "login",
  "manage",
  "more",
  "og",
  "photos",
  "pricing",
  "privacy",
  "preview",
  "public",
  "robots",
  "schedule",
  "settings",
  "sign-in",
  "sitemap",
  "start",
  "static",
  "support",
  "terms",
  "tim-zhang",
  "webhook",
  "www",
]);

export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(String(slug || "").toLowerCase());
}

export function bookingPath(slug: string) {
  return "/" + String(slug || "").replace(/^\/+/, "");
}

/** Compact label in the UI — host + path, no scheme. */
export function displayBookingLink(slug: string) {
  return BOOKING_HOST + bookingPath(slug);
}

/** Short branded URL coaches forward in messages. */
export function brandedBookingUrl(slug: string) {
  return "https://" + displayBookingLink(slug);
}

/** Absolute URL that opens the live booking page in this environment. */
export function liveBookingUrl(slug: string) {
  const path = bookingPath(slug);
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin + path;
  }
  return brandedBookingUrl(slug);
}

export function displayManageLink() {
  return BOOKING_HOST + MANAGE_PATH;
}

export function brandedManageUrl() {
  return "https://" + displayManageLink();
}

export function liveManageUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin + MANAGE_PATH;
  }
  return brandedManageUrl();
}
