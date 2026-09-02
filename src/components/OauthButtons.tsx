import type { ReactNode } from "react";
import { OAUTH_PROVIDERS, providerLabel, type OAuthProvider } from "@/lib/oauth";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path
        fill="#fff"
        d="M16.67 12.56h-2.4V20h-3.16v-7.44H9.3v-2.68h1.81V8.34c0-1.9 1.14-4.66 4.54-4.66l2.36.03v2.64h-1.71c-.52 0-1.25.26-1.25 1.36v1.87h2.96l-.34 2.68z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#000"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
      />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <defs>
        <linearGradient id="bookmeIg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="45%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#bookmeIg)" />
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.05" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.15" cy="7.85" r="0.95" fill="#fff" />
    </svg>
  );
}

const MARKS: Record<OAuthProvider, ReactNode> = {
  google: <GoogleMark />,
  facebook: <FacebookMark />,
  x: <XMark />,
  instagram: <InstagramMark />,
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
            <span className="absolute left-4 flex h-8 w-8 items-center justify-center">{MARKS[provider]}</span>
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
