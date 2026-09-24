/**
 * Origins Better Auth accepts on credentialed POSTs (sign-up, sign-in).
 * A browser Origin that is absent here is rejected as "Invalid origin".
 *
 * Production trusts bookme.training, `BETTER_AUTH_URL`, and this deployment's
 * own Vercel host. Wildcard preview hosts (`*.vercel.app`, `*.grok-sandbox.com`)
 * are added for sandbox (no fixed `BETTER_AUTH_URL`) and for Vercel
 * preview/development, where the branch alias differs from `VERCEL_URL`.
 * Callers pass `PREVIEW_ALLOWED_HOSTS` as `previewHosts`.
 */
export const PRODUCTION_ORIGINS = ["https://bookme.training", "https://www.bookme.training"];

const LOCAL_DEV_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"];

export type TrustedOriginEnv = {
  BETTER_AUTH_URL?: string;
  BOOKME_APP_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_ENV?: string;
};

/** Apex + www variants so bookme.training and www.bookme.training both work. */
function withWwwVariants(origin: string): string[] {
  try {
    const u = new URL(origin);
    const out = new Set<string>([u.origin]);
    if (u.hostname.startsWith("www.")) out.add(`${u.protocol}//${u.hostname.slice(4)}`);
    else out.add(`${u.protocol}//www.${u.hostname}`);
    return [...out];
  } catch {
    return origin ? [origin] : [];
  }
}

/** `VERCEL_URL` is a hostname. Trust https and http for that exact host. */
function deploymentHostOrigins(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];
  const bare = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");
  if (!bare || bare.includes("*") || bare.includes(" ")) return [];
  return [`https://${bare}`, `http://${bare}`];
}

export function trustedAuthOrigins(env: TrustedOriginEnv, previewHosts: readonly string[]): string[] {
  const explicitBaseURL = env.BETTER_AUTH_URL?.trim() || "";
  const appUrl = env.BOOKME_APP_URL?.trim() || "";
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase() || "";
  const trustPreviewHosts = !explicitBaseURL || (vercelEnv !== "" && vercelEnv !== "production");
  const preview = trustPreviewHosts
    ? [...previewHosts, ...previewHosts.flatMap((host) => [`https://${host}`, `http://${host}`])]
    : [];

  return [
    ...new Set(
      [
        ...PRODUCTION_ORIGINS,
        ...(explicitBaseURL ? withWwwVariants(explicitBaseURL) : []),
        ...withWwwVariants(appUrl),
        ...LOCAL_DEV_ORIGINS,
        ...deploymentHostOrigins(env.VERCEL_URL),
        ...deploymentHostOrigins(env.VERCEL_BRANCH_URL),
        ...preview,
      ].filter(Boolean),
    ),
  ];
}
