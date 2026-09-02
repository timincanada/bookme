const BUTTONS = [
  { provider: "google", label: "Continue with Google" },
  { provider: "facebook", label: "Continue with Facebook" },
  { provider: "x", label: "Continue with X" },
] as const;

export function OauthButtons({ from }: { from: "login" | "register" }) {
  return (
    <>
      <div className="mt-5">
        {BUTTONS.map((item, i) => (
          <a
            key={item.provider}
            href={`/api/auth/oauth/${item.provider}/start?from=${from}`}
            className={`${i === 0 ? "" : "mt-3 "}block w-full rounded-2xl border border-line py-3 text-center font-semibold text-ink`}
          >
            {item.label}
          </a>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-sm text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
