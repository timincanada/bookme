import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth/client";
import { getStudentMe } from "@/lib/bookme/student-api";

/** App start screen: signed-in coaches go to the app, signed-in students to their portal. */
export const Route = createFileRoute("/welcome")({ component: Welcome });

function Welcome() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const session = await authClient.getSession().catch(() => null);
      if (!alive) return;
      if (session?.data?.user) return void navigate({ to: "/app", replace: true });
      const me = await getStudentMe().catch(() => ({ signedIn: false as const }));
      if (!alive) return;
      if (me.signedIn) return void navigate({ to: "/manage", search: { email: undefined, token: undefined }, replace: true });
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Logo />
        <h1 className="mt-10 font-display text-4xl font-medium leading-tight">More time coaching. Less time scheduling.</h1>
        {checking ? (
          <p className="mt-8 text-muted">Loading…</p>
        ) : (
          <div className="mt-10 space-y-3">
            <Link to="/login" className="block rounded-2xl bg-forest p-5 text-on-forest">
              <span className="block font-display text-2xl">I'm a coach</span>
              <span className="mt-1 block text-sm opacity-80">Sign in to your schedule, clients and messages.</span>
            </Link>
            <Link
              to="/manage"
              search={{ email: undefined, token: undefined }}
              className="block rounded-2xl bg-card p-5 ring-1 ring-line"
            >
              <span className="block font-display text-2xl text-ink">I'm a student</span>
              <span className="mt-1 block text-sm text-muted">See your lessons and message your coach. We email you a code.</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
