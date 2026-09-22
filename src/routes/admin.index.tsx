import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip, StatCard } from "@/components/bookme/admin-ui";
import { adminSummary } from "@/lib/bookme/admin-api";
import { attentionList, formatCad, PERIODS, pct, type PeriodKey } from "@/lib/bookme/admin-console";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: Overview });

type Data = Extract<Awaited<ReturnType<typeof adminSummary>>, { ok: true }>;

function Overview() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    adminSummary({ data: { period } }).then((r) => {
      if (alive && r.ok) setData(r);
    });
    return () => {
      alive = false;
    };
  }, [period]);

  if (!data) return <p className="text-muted">Loading…</p>;
  const s = data.summary;
  const attention = attentionList(s.attention);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-medium">Overview</h1>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                period === p.key ? "bg-forest text-on-forest" : "ring-1 ring-line hover:bg-paper-2",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {s.from} → {s.to}
      </p>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Card payments" value={formatCad(s.money.cardPaid)} sub={`${s.money.cardCount} payments`} />
        <StatCard label="Platform 5%" value={formatCad(s.money.platformFee)} sub="BookMe share" />
        <StatCard label="Cash collected" value={formatCad(s.money.cashCollected)} sub="marked by coaches" />
        <StatCard label="Refunded" value={formatCad(s.money.refunded)} sub={`${s.money.refundCount} refunds`} />
        <StatCard label="Lessons booked" value={String(s.lessons.booked)} sub={`${s.lessons.confirmed} confirmed · ${s.lessons.cancelled} cancelled`} />
        <StatCard label="Coaches with lessons" value={String(s.lessons.coachesActive)} sub={`${s.lessons.imported} imported lessons`} />
        <StatCard
          label="Coaches"
          value={String(s.coaches.total)}
          sub={`${s.coaches.active} paying · ${s.coaches.trialing} trialing · ${s.coaches.banned} banned`}
        />
        <StatCard
          label="Paying share"
          value={pct(s.coaches.active, s.coaches.total)}
          sub={`${s.coaches.connected} connected to Stripe`}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl">Needs a look</h2>
          {attention.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-sage-3 p-4 text-sm text-forest">Nothing waiting.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map((a) => (
                <li key={a.kind}>
                  <Link
                    to={a.href ?? "/admin"}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 text-sm ring-1 ring-line"
                  >
                    <span>{a.label}</span>
                    <Chip tone="warn">{a.count}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 font-display text-xl">Active plans</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.plans.length === 0 ? <p className="text-sm text-muted">No active subscriptions.</p> : null}
            {s.plans.map((p) => (
              <Chip key={p.plan} tone="good">
                {p.plan}: {p.count}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl">Recent admin activity</h2>
          <ul className="mt-3 space-y-2">
            {data.actions.length === 0 ? <p className="text-sm text-muted">No actions yet.</p> : null}
            {data.actions.map((a) => (
              <li key={a.id} className="rounded-2xl bg-card p-3 text-sm ring-1 ring-line">
                <p className="font-semibold">
                  {a.kind} <span className="font-normal text-muted">· {a.subjectType}</span>
                </p>
                <p className="text-xs text-muted">
                  {a.actor} · {new Date(a.at).toLocaleString("en-CA")} {a.detail ? `· ${a.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
