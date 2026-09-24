import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { authProvidersForHost, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useNativePlatform } from "@/lib/native/platform";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ensureDemoCoach } from "@/lib/bookme/api";
import { DEMO_COACH } from "@/lib/bookme/demo";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const native = useNativePlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureDemoCoach();
  }, []);

  if (isPending) {
    return <main className="min-h-screen bg-paper" />;
  }
  if (user) return <Navigate to="/app" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (email.trim().toLowerCase() === DEMO_COACH.email) await ensureDemoCoach();
    const { error: err } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (err) {
      setError(
        err.status === 403
          ? "Confirm your email first — we just sent you a new link."
          : err.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : err.message || "Wrong email or password",
      );
      return;
    }
    window.location.href = "/app";
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <Logo />
        <h1 className="mt-8 font-display text-4xl font-medium">Sign in</h1>
        <p className="mt-2 text-ink-soft">Use your coach account.</p>
        {authEnabled && native.ready && native.platform === "web" ? (
          <div className="mt-8 space-y-2">
            {authProvidersForHost().map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/app" })}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-line bg-card text-sm font-semibold hover:bg-paper-2"
              >
                Continue with {p.label}
              </button>
            ))}
            <p className="py-2 text-center text-sm text-muted">or</p>
          </div>
        ) : null}
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
          </label>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <Button type="submit" size="field" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-left text-sm text-forest"
          onClick={() => {
            setEmail(DEMO_COACH.email);
            setPassword(DEMO_COACH.password);
          }}
        >
          Use demo coach
          <span className="mt-0.5 block text-muted">{DEMO_COACH.email}</span>
        </button>
        <p className="mt-6 text-sm text-muted">
          New here?{" "}
          <Link to="/start" className="font-medium text-forest hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
