import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip, Money, StatCard, TableShell } from "@/components/bookme/admin-ui";
import { Button } from "@/components/ui/button";
import { adminActOnCoach, adminCoach } from "@/lib/bookme/admin-api";
import { can, monthLabel, type AdminRole, subscriptionTone } from "@/lib/bookme/admin-console";

export const Route = createFileRoute("/admin/coaches/$id")({ component: CoachDetail });

type Data = Extract<Awaited<ReturnType<typeof adminCoach>>, { ok: true }>;

function CoachDetail() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    return adminCoach({ data: { id } }).then((r) => {
      if (r.ok) setData(r);
      else setMsg(r.error);
    });
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(action: "set_access" | "ban" | "unban" | "extend_trial", extra: { grant?: string; days?: number } = {}) {
    setBusy(true);
    const res = await adminActOnCoach({ data: { coachId: id, action, note, ...extra } });
    setBusy(false);
    setMsg(res.ok ? res.message : res.error);
    if (res.ok) {
      setNote("");
      void load();
    }
  }

  if (!data) return <p className="text-muted">{msg || "Loading…"}</p>;
  const c = data.coach;
  const role = data.role as AdminRole;

  return (
    <>
      <Link to="/admin/coaches" className="text-sm font-semibold text-forest">
        Coaches
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-3xl font-medium">{c.name}</h1>
        <Chip tone={subscriptionTone(c.status, c.banned)}>{c.banned ? "banned" : c.status || "none"}</Chip>
        {c.deletedAt ? <Chip tone="bad">deleted</Chip> : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        {c.specialty} · {c.email} · <a className="text-forest" href={`/${c.slug}`}>/{c.slug}</a> · {c.city || "—"} · {c.timezone}
      </p>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lessons" value={String(data.lessons.confirmed)} sub={`${data.lessons.upcoming} upcoming · ${data.lessons.cancelled} cancelled`} />
        <StatCard label="Last 30 days" value={String(data.lessons.last30)} sub={`${data.lessons.imported} imported`} />
        <StatCard label="Clients" value={String(data.clients.total)} sub={`${data.clients.withEmail} with email`} />
        <StatCard label="Recurring schedules" value={String(data.activeSeries)} sub="active" />
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Plan" value={c.plan || "none"} sub={c.trialEndsAt ? `trial until ${c.trialEndsAt.slice(0, 10)}` : ""} />
        <StatCard label="Stripe payouts" value={c.stripeConnected ? "Connected" : "Not connected"} sub={`card ${c.acceptCard ? "on" : "off"} · cash ${c.acceptCash ? "on" : "off"}`} />
        <StatCard label="Joined" value={c.createdAt.slice(0, 10)} sub={c.subscribed ? "has subscription" : "no subscription"} />
      </section>

      <h2 className="mt-8 font-display text-2xl">Monthly money</h2>
      <TableShell
        head={
          <tr>
            <th className="px-4 py-2.5">Month</th>
            <th className="px-4 py-2.5 text-right">Card paid</th>
            <th className="px-4 py-2.5 text-right">Platform 5%</th>
            <th className="px-4 py-2.5 text-right">Cash</th>
            <th className="px-4 py-2.5 text-right">Refunded</th>
            <th className="px-4 py-2.5 text-right">Payments</th>
          </tr>
        }
      >
        {data.months.length === 0 ? (
          <tr>
            <td className="px-4 py-3 text-muted" colSpan={6}>
              No payments yet.
            </td>
          </tr>
        ) : null}
        {data.months.map((m) => (
          <tr key={m.month}>
            <td className="px-4 py-3">{monthLabel(m.month)}</td>
            <td className="px-4 py-3 text-right"><Money amount={m.cardPaid} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.platformFee} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.cash} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.refunded} /></td>
            <td className="px-4 py-3 text-right tabular-nums">{m.payments}</td>
          </tr>
        ))}
      </TableShell>

      <section className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="font-display text-2xl">Actions</h2>
        <p className="mt-1 text-sm text-muted">Every action is recorded with your email.</p>
        <input className="field mt-3" placeholder="Note (optional, shown in the log)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("extend_trial", { days: 14 })}>
            Extend trial 14 days
          </Button>
          {can(role, "set_access") ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("set_access", { grant: "paid" })}>
                Grant paid access
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("set_access", { grant: "" })}>
                Clear grant
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("set_access", { grant: "unpaid" })}>
                Block access
              </Button>
            </>
          ) : null}
          {can(role, "ban_coach") ? (
            <Button size="sm" variant="outline" className="text-coral" disabled={busy} onClick={() => void act(c.banned ? "unban" : "ban")}>
              {c.banned ? "Unban coach" : "Ban coach"}
            </Button>
          ) : null}
        </div>
        {!can(role, "set_access") ? <p className="mt-3 text-xs text-muted">Access and ban actions are owner-only.</p> : null}
        {msg ? <p className="mt-3 text-sm text-forest">{msg}</p> : null}
      </section>

      <h2 className="mt-8 font-display text-2xl">Action log</h2>
      <ul className="mt-3 space-y-2">
        {data.actions.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : null}
        {data.actions.map((a) => (
          <li key={a.id} className="rounded-2xl bg-card p-3 text-sm ring-1 ring-line">
            <p className="font-semibold">
              {a.kind} {a.detail ? <span className="font-normal text-muted">· {a.detail}</span> : null}
            </p>
            <p className="text-xs text-muted">
              {a.actor} · {new Date(a.at).toLocaleString("en-CA")} {a.note ? `· ${a.note}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
