type AppUrlEnv = {
  BOOKME_APP_URL?: string;
  VITE_APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_ENV?: string;
};

/** Hostname only. `VERCEL_URL` is a host; tolerate an accidental scheme or path. */
function deploymentHost(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  return raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");
}

/**
 * Origin for links in email (manage codes, weather asks, Stripe returns).
 * Preview ignores `BOOKME_APP_URL` (often https://bookme.training) and uses
 * this deployment's host so a manage link stays on the preview.
 */
export function publicAppUrl(env: AppUrlEnv = process.env) {
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase() || "";
  if (vercelEnv === "preview") {
    const host = deploymentHost(env.VERCEL_URL) || deploymentHost(env.VERCEL_BRANCH_URL);
    if (host) return `https://${host}`;
  }
  const raw =
    env.BOOKME_APP_URL ||
    env.VITE_APP_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    (deploymentHost(env.VERCEL_URL) ? `https://${deploymentHost(env.VERCEL_URL)}` : "") ||
    "https://bookme.training";
  return raw.replace(/\/$/, "");
}
