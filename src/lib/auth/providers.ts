/**
 * Sign-in providers offered by this app.
 *
 * Source of truth for BOTH the server (`server.ts`) and the client (`client.ts`
 * / sign-in buttons). Kept dependency-free so the client never pulls Better Auth
 * server code (or `pg`) into the browser bundle.
 *
 * - **Sandbox live preview** (no fixed public URL): federate through the Grok
 *   auth broker via `genericOAuth` (`grok-google` / `grok-x`). The preview
 *   client only allows `*.grok-sandbox.com` callbacks.
 * - **Production (bookme.training)**: use Better Auth's built-in Google social
 *   provider (`providerId: "google"`) with `GOOGLE_CLIENT_ID` /
 *   `GOOGLE_CLIENT_SECRET`. The broker preview client rejects
 *   `bookme.training` redirect URIs ("Invalid redirect URI").
 */
export type AuthProvider = {
  /** Local provider id (callback path segment / signIn argument). */
  providerId: string;
  /** How the client should start sign-in. */
  mode: "oauth2" | "social";
  /** Upstream id (broker `idp` hint, or Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

/** Broker-backed providers (sandbox / when GROK_AUTH_CLIENT_* is provisioned). */
export const GROK_PROVIDERS: readonly AuthProvider[] = [
  { providerId: "grok-google", mode: "oauth2", idp: "google", label: "Google" },
  { providerId: "grok-x", mode: "oauth2", idp: "twitter", label: "X" },
];

/** Direct Google social provider for public production hosts. */
export const GOOGLE_SOCIAL_PROVIDER: AuthProvider = {
  providerId: "google",
  mode: "social",
  idp: "google",
  label: "Google",
};

const PRODUCTION_HOSTS = new Set(["bookme.training", "www.bookme.training"]);

/** True when this browser origin should use direct Google (not the preview broker). */
export function useDirectGoogleAuth(hostname?: string): boolean {
  const host =
    (typeof hostname === "string" && hostname) ||
    (typeof window !== "undefined" ? window.location.hostname : "");
  if (host) return PRODUCTION_HOSTS.has(host);
  // SSR: infer from public app URL when set at build time.
  const app = String(import.meta.env.VITE_APP_URL || import.meta.env.VITE_AUTH_URL || "");
  return app.includes("bookme.training");
}

/** Providers to render on the current host. */
export function authProvidersForHost(hostname?: string): readonly AuthProvider[] {
  return useDirectGoogleAuth(hostname) ? [GOOGLE_SOCIAL_PROVIDER] : GROK_PROVIDERS;
}

/** @deprecated Prefer `authProvidersForHost()` — kept for older imports. */
export const AUTH_PROVIDERS = GROK_PROVIDERS;
