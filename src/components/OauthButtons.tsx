import { OAUTH_PROVIDERS, providerLabel, type OAuthProvider } from "@/lib/oauth";

const ICONS: Record<OAuthProvider, string> = {
  google: "G",
  facebook: "f",
  x: "X",
  instagram: "Ig",
};

export function OauthButtons({ from, error }: { from: "login" | "register"; error?: string }) {
  return (
    <div className="mt-5">
      <div className="space-y-3">
        {OAUTH_PROVIDERS.map((provider: OAuthProvider) => (
          <a
            key={provider}
            href={`/api/auth/oauth/${provider}/start?from=${from}`}
            className="relative flex w-full items-center justify-center rounded-2xl border border-brand bg-white py-4 font-semibold text-ink"
          >
            <span className="absolute left-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm font-bold">
              {ICONS[provider]}
            </span>
            Continue with {providerLabel(provider)}
          </a>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <p className="text-sm text-muted">or</p>
        <div className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
