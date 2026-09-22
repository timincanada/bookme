import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ADMIN_EMAIL } from "@/lib/bookme/admin";
import { adminSummary } from "@/lib/bookme/admin-api";
import { REPORT_TIMEZONE } from "@/lib/bookme/admin-console";
import type { AdminDenialReason } from "@/lib/bookme/admin-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminShell });

type Tab = {
  to: "/admin" | "/admin/coaches" | "/admin/revenue" | "/admin/lessons" | "/admin/lookup" | "/admin/health" | "/admin/team";
  label: string;
  exact?: boolean;
  ownerOnly?: boolean;
};

const TABS: Tab[] = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/coaches", label: "Coaches" },
  { to: "/admin/revenue", label: "Revenue" },
  { to: "/admin/lessons", label: "Lessons" },
  { to: "/admin/lookup", label: "Lookup" },
  { to: "/admin/health", label: "Health" },
  { to: "/admin/team", label: "Team", ownerOnly: true },
];

type DeniedState = { kind: "denied"; reason?: AdminDenialReason };
type OkState = { role: string; email: string };

function AdminShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<OkState | DeniedState | null>(null);

  useEffect(() => {
    if (!user) return;
    adminSummary({ data: { period: "today" } }).then((r) =>
      setState(r.ok ? { role: r.role, email: r.email } : { kind: "denied", reason: "reason" in r ? r.reason : undefined }),
    );
  }, [user]);

  if (isPending) return <main className="min-h-screen bg-paper" />;
  if (!user) return <RedirectToSignIn />;
  if (state && "kind" in state && state.kind === "denied") {
    return <AdminDenied userEmail={user.primaryEmail} reason={state.reason} />;
  }

  const access = (state && !("kind" in state) ? state : null) as OkState | null;

  return (
    <main className="min-h-screen bg-paper pb-16">
      <header className="border-b border-line bg-card/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-forest px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-forest">
              Ops
            </span>
          </div>
          <span className="truncate text-xs text-muted">
            {access?.email} · {access?.role === "owner" ? "Owner" : "Admin"}
          </span>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-5 pb-3 sm:px-8" aria-label="Console">
          <ul className="flex gap-1.5">
            {TABS.filter((t) => !t.ownerOnly || access?.role === "owner").map((t) => {
              const on = t.exact ? pathname === t.to || pathname === `${t.to}/` : pathname.startsWith(t.to);
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={cn(
                      "block whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm",
                      on ? "bg-forest text-on-forest" : "ring-1 ring-line hover:bg-paper-2",
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <Outlet />
        <p className="mt-10 text-xs text-muted">All dates and totals are in {REPORT_TIMEZONE}. Students are never named here.</p>
      </div>
    </main>
  );
}

function AdminDenied({ userEmail, reason }: { userEmail: string | null; reason?: AdminDenialReason }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unverified = reason === "UNVERIFIED";

  async function switchToFounder() {
    setBusy(true);
    setError("");
    try {
      await signOut("/sign-in");
    } catch {
      setBusy(false);
      setError("Could not sign out. Try again, or open Account and sign out there.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl">You don't have access</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Signed in as <span className="font-semibold text-ink">{userEmail || "unknown"}</span>
          {unverified ? " — email not verified yet." : "."} This page is for the verified founder/team
          account <span className="font-semibold text-ink">{ADMIN_EMAIL}</span>
          {unverified
            ? ". Confirm the Better Auth verification link in that inbox, then reopen /admin."
            : ". Sign out of this coach session, sign in as the founder, then reopen /admin."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button type="button" size="field" className="max-w-sm" disabled={busy} onClick={() => void switchToFounder()}>
            {busy ? "Signing out…" : `Sign out & use ${ADMIN_EMAIL}`}
          </Button>
          {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}
          <p className="max-w-sm text-xs text-muted">
            After sign-out you land on sign-in. Use {ADMIN_EMAIL}
            {unverified ? ", confirm verification if prompted," : ","} then open /admin again.
          </p>
          <Link to="/" className="text-sm font-semibold text-forest">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
