import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { VerticalPicker } from "@/components/bookme/vertical-picker";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useNativePlatform } from "@/lib/native/platform";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyCoach, saveCoachBasics, ensureDemoCoach } from "@/lib/bookme/api";
import { DEMO_COACH } from "@/lib/bookme/demo";
import { verticalById, type VerticalId } from "@/lib/bookme/verticals";

export const Route = createFileRoute("/start")({ component: Start });

function Start() {
  const { user, isPending } = useCurrentUserState();
  const native = useNativePlatform();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verticalId, setVerticalId] = useState<VerticalId>("tennis");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const vertical = verticalById(verticalId);

  useEffect(() => {
    void ensureDemoCoach();
  }, []);

  if (isPending) return <main className="min-h-screen bg-paper" />;
  if (user) return <Navigate to="/app/setup" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data: created, error: err } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: "/app/setup",
    });
    if (err) {
      setBusy(false);
      setError(err.message || "That email is already registered");
      return;
    }
    if (!created?.token) {
      // Email verification required: the confirmation link signs them in.
      setBusy(false);
      setError(`We sent a confirmation link to ${email}. Open it to finish setting up.`);
      return;
    }
    try {
      await getMyCoach();
      await saveCoachBasics({
        data: { name, title: `${vertical?.label ?? "Tennis"} Coach`, duration: 60, priceCad: 80 },
      });
    } catch {
      /* setup can finish later */
    }
    window.location.href = "/app/setup";
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-12">
        <Logo />
        <h1 className="mt-8 font-display text-4xl font-medium">Open for business</h1>
        <p className="mt-2 text-ink-soft">Create a coach account, then set your lesson and hours.</p>
        {authEnabled && native.ready && native.platform === "web" ? (
          <div className="mt-8 space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/app/setup" })}
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
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Password</span>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          <div>
            <p className="mb-2 text-sm font-medium">What do you coach?</p>
            <p className="mb-3 text-sm text-muted">Sport, fitness, music, arts, or academic — pick the closest fit.</p>
            <VerticalPicker value={verticalId} onChange={(id) => setVerticalId(id)} />
          </div>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <Button type="submit" size="field" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Already coaching?{" "}
          <Link to="/login" className="font-medium text-forest hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-sm text-muted">
          Try the demo: {DEMO_COACH.email}
        </p>
      </div>
    </main>
  );
}
