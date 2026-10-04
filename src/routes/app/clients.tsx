import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listMyClients } from "@/lib/bookme/api";
import { Card } from "@/components/bookme/ui/card";
import { ClientRow } from "@/components/bookme/ui/client-row";
import { EmptyState } from "@/components/bookme/ui/empty-state";
import { PageFrame } from "@/components/bookme/ui/page-frame";
import { PageTitle } from "@/components/bookme/ui/page-title";
import { SearchField } from "@/components/bookme/ui/search-field";
import { ErrorState, ListSkeleton } from "@/components/bookme/ui/screen-states";
import { useCoach } from "@/lib/bookme/coach-context";
import { filterClients, sortClients, type ClientSort } from "@/lib/bookme/client-sort";
import { useDemoUi } from "@/lib/bookme/demo-ui";
import { hideQaRecords } from "@/lib/bookme/qa-surface";

export const Route = createFileRoute("/app/clients")({ component: Clients });

function Clients() {
  const { coach } = useCoach();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [clients, setClients] = useState<Extract<Awaited<ReturnType<typeof listMyClients>>, { ok: true }>["clients"]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ClientSort>("az");
  const demo = useDemoUi();

  function load() {
    setPhase("loading");
    listMyClients()
      .then((r) => {
        if (!r.ok) {
          setPhase("error");
          return;
        }
        setClients(hideQaRecords(r.clients, demo));
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const visible = useMemo(() => sortClients(filterClients(clients, query), sort), [clients, query, sort]);

  if (pathname !== "/app/clients") return <Outlet />;
  if (!coach) return null;

  return (
    <PageFrame>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <PageTitle title="Clients" subtitle="People who book with you" />
        <label className="mt-1 shrink-0">
          <span className="sr-only">Sort clients</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ClientSort)}
            aria-label="Sort clients"
            className="min-h-11 rounded-[var(--radius-pill)] bg-card px-3 text-sm font-medium text-ink ring-1 ring-line"
          >
            <option value="recent">Recent</option>
            <option value="az">A–Z</option>
            <option value="booked">Most booked</option>
          </select>
        </label>
      </div>
      <SearchField value={query} onChange={setQuery} placeholder="Search clients" label="Search clients" />
      {phase === "loading" ? <ListSkeleton /> : null}
      {phase === "error" ? <ErrorState onRetry={load} /> : null}
      {phase === "ready" && visible.length === 0 ? (
        <EmptyState
          title={query ? "No matches" : "No clients yet"}
          body={query ? "Try another name or email." : "Clients will appear after their first booking."}
        />
      ) : null}
      {phase === "ready" && visible.length > 0 ? (
        <Card className="mt-4">
          <ul className="divide-y divide-line">
            {visible.map((c) => (
              <ClientRow key={c.id} id={c.id} name={c.name} email={c.email} />
            ))}
          </ul>
        </Card>
      ) : null}
    </PageFrame>
  );
}
