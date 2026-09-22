import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminBanCoach, adminOverview, adminSetAccess } from "@/lib/bookme/api";
import { grantLabel } from "@/lib/bookme/admin";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof adminOverview>>, { ok: true }> | null>(null);
  const [denied, setDenied] = useState("");

  function load() {
    adminOverview().then((r) => {
      if (!r.ok) setDenied(r.error);
      else setData(r);
    });
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (isPending) return <main className="min-h-screen bg-paper" />;
  if (!user) return <RedirectToSignIn />;
  if (denied) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <div>
          <h1 className="font-display text-3xl">You don't have access</h1>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-forest">
            Home
          </Link>
        </div>
      </main>
    );
  }
  if (!data) return <main className="min-h-screen bg-paper p-8 text-muted">Loading…</main>;

  return (
    <main className="min-h-screen bg-paper px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-medium">Coaches</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Registered" value={String(data.stats.registeredCoaches)} />
          <Stat label="On trial" value={String(data.stats.onTrial)} />
          <Stat label="Subscribed" value={String(data.stats.subscribed)} />
          <Stat label="Public visitors" value={String(data.stats.visitors)} />
        </div>
        <p className="mt-2 text-sm text-muted">{data.stats.conversionLabel}</p>
        <ul className="mt-8 space-y-3">
          {data.coaches.map((c) => (
            <li key={c.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-muted">{c.email} · /{c.slug}</p>
              <p className="mt-1 text-sm">
                Plan {c.plan} · {c.status} · trial {c.trialEndsAt} · {grantLabel(c.accessGrant)}
                {c.banned ? " · Banned" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await adminSetAccess({ data: { id: c.id, grant: "paid" } }); load(); }}>
                  Mark paid
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { await adminSetAccess({ data: { id: c.id, grant: "unpaid" } }); load(); }}>
                  Mark unpaid
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { await adminSetAccess({ data: { id: c.id, grant: "" } }); load(); }}>
                  Clear grant
                </Button>
                {!c.banned ? (
                  <Button size="sm" variant="outline" className="text-coral" onClick={async () => {
                    if (confirm("Ban this coach? They will not be able to sign in or take new bookings.")) {
                      await adminBanCoach({ data: { id: c.id } });
                      load();
                    }
                  }}>
                    Ban
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
