import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyClients } from "@/lib/bookme/api";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/clients")({ component: Clients });

function Clients() {
  const { coach } = useCoach();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [clients, setClients] = useState<Extract<Awaited<ReturnType<typeof listMyClients>>, { ok: true }>["clients"]>([]);

  useEffect(() => {
    listMyClients().then((r) => {
      if (r.ok) setClients(r.clients);
    });
  }, []);

  if (pathname !== "/app/clients") return <Outlet />;
  if (!coach) return null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-3xl font-medium">Clients</h1>
      <p className="mt-1 text-muted">{clients.length} people who booked with you</p>
      <ul className="mt-5 space-y-3">
        {clients.map((c) => (
          <li key={c.id}>
            <Link to="/app/clients/$id" params={{ id: c.id }} className="block rounded-2xl bg-card p-4 ring-1 ring-line">
              <p className="type-primary break-words font-semibold">{c.name}</p>
              <p className="type-follow break-words text-sm text-muted">{c.email}</p>
            </Link>
          </li>
        ))}
        {clients.length === 0 ? (
          <p className="text-muted">No clients yet. First booking creates the record.</p>
        ) : null}
      </ul>
    </div>
  );
}
