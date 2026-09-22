/**
 * Student email-code login — secrets and limits (server-only; uses crypto).
 *
 * Codes and link tokens are never stored in plain text: only an HMAC keyed with
 * the app secret. Comparison is constant-time.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const CODE_TTL_MS = 30 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 20;
export const STUDENT_COOKIE = "bookme_student";

let devSecret: string | null = null;

function secret() {
  const configured = String(process.env.BETTER_AUTH_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required for student sign-in");
  }
  devSecret ??= `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  return devSecret;
}

export function hashSecret(kind: "code" | "token" | "session", value: string) {
  return createHmac("sha256", secret()).update(`${kind}:${value}`).digest("hex");
}

export function sameHash(a: string | null | undefined, b: string) {
  if (!a) return false;
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Codes are shown to the browser only in local development when explicitly asked. */
export function devShowsCode() {
  return process.env.NODE_ENV !== "production" && process.env.BOOKME_DEV_SHOW_CODE === "1";
}
