import { OAUTH_PROVIDERS, providerLabel, type OAuthProvider } from "@/lib/oauth";

export function OauthButtons({ from }: { from: "login" | "register" }) {
  return (
    <div className="mt-4">
      <p className="text-center text-sm text-muted">or</p>
      <div className="mt-3 space-y-2">
        {OAUTH_PROVIDERS.map((provider: OAuthProvider) => (
          <a
            key={provider}
            href={`/api/auth/oauth/${provider}/start?from=${from}`}
            className="block w-full rounded-2xl bg-brand py-3 text-center font-semibold text-white"
          >
            Continue with {providerLabel(provider)}
          </a>
        ))}
      </div>
    </div>
  );
}
