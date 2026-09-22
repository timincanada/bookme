import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip, StatCard } from "@/components/bookme/admin-ui";
import { adminHealth } from "@/lib/bookme/admin-api";
import { jobFreshness } from "@/lib/bookme/admin-console";

export const Route = createFileRoute("/admin/health")({ component: Health });

type Data = Extract<Awaited<ReturnType<typeof adminHealth>>, { ok: true }>;
const LABELS: Record<string, string> = {
  pendingPurge: "Deleted coaches awaiting purge",
  stuckHolds: "Checkout holds stuck over a day",
  remindersDue: "Reminders due in the next 24 h",
  clientsWithoutEmail: "Clients without an email",
  devices: "Registered app devices",
  studentAccounts: "Student portal accounts",
  conversations: "Conversations",
};

function Health() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    adminHealth().then((r) => {
      if (r.ok) setData(r);
    });
  }, []);
  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <>
      <h1 className="font-display text-3xl font-medium">Health</h1>

      <h2 className="mt-5 font-display text-2xl">Background jobs</h2>
      <ul className="mt-3 space-y-2">
        {data.jobs.length === 0 ? (
          <li className="rounded-2xl bg-card p-4 text-sm ring-1 ring-line">
            No job has reported yet. Check that the cron schedule calls <code>/api/cron/reminders</code> with the secret.
          </li>
        ) : null}
        {data.jobs.map((j) => {
          const fresh = jobFreshness(new Date(j.ranAt));
          return (
            <li key={j.job} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-4 text-sm ring-1 ring-line">
              <span>
                <span className="font-semibold">{j.job}</span>
                <span className="block text-xs text-muted">{j.detail || "—"}</span>
              </span>
              <span className="flex items-center gap-2">
                <Chip tone={fresh.state === "ok" ? "good" : "warn"}>{fresh.text}</Chip>
                {j.ok ? null : <Chip tone="bad">failed</Chip>}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 font-display text-2xl">Counts</h2>
      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data.counts).map(([k, v]) => (
          <StatCard key={k} label={LABELS[k] ?? k} value={String(v)} />
        ))}
      </section>
      <p className="mt-4 text-xs text-muted">Push delivery is not wired yet, so device counts grow but no notifications are sent.</p>
    </>
  );
}
