export const VISITOR_COOKIE = "bookme_vid";

export function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  };
}
