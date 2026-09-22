import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExportButtons, Money, StatCard, TableShell } from "@/components/bookme/admin-ui";
import { adminRevenue } from "@/lib/bookme/admin-api";
import { formatCad, monthLabel } from "@/lib/bookme/admin-console";

export const Route = createFileRoute("/admin/revenue")({ component: Revenue });

type Data = Extract<Awaited<ReturnType<typeof adminRevenue>>, { ok: true }>;

function Revenue() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    adminRevenue({ data: { months } }).then((r) => {
      if (alive && r.ok) setData(r);
    });
    return () => {
      alive = false;
    };
  }, [months]);

  if (!data) return <p className="text-muted">Loading…</p>;
  const rows = [...data.months].reverse();
  const totals = data.months.reduce(
    (acc, m) => ({
      cardPaid: acc.cardPaid + m.cardPaid,
      platformFee: acc.platformFee + m.platformFee,
      coachShare: acc.coachShare + m.coachShare,
      cash: acc.cash + m.cash,
      refunded: acc.refunded + m.refunded,
    }),
    { cardPaid: 0, platformFee: 0, coachShare: 0, cash: 0, refunded: 0 },
  );
  const peak = Math.max(1, ...data.months.map((m) => m.cardPaid));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-medium">Revenue</h1>
        <div className="flex items-center gap-2">
          <select className="field h-10 w-auto" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[6, 12, 24].map((m) => (
              <option key={m} value={m}>
                Last {m} months
              </option>
            ))}
          </select>
          <ExportButtons kind="revenue" />
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Card payments" value={formatCad(totals.cardPaid)} sub={`last ${months} months`} />
        <StatCard label="Platform 5%" value={formatCad(totals.platformFee)} sub="BookMe share" />
        <StatCard label="Paid to coaches" value={formatCad(totals.coachShare)} sub="before Stripe fees" />
        <StatCard label="Refunded" value={formatCad(totals.refunded)} sub={`cash collected ${formatCad(totals.cash)}`} />
      </section>

      <div className="mt-6 rounded-2xl bg-card p-4 ring-1 ring-line">
        <div className="flex h-40 items-end gap-1.5">
          {data.months.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(m.month)} · ${formatCad(m.cardPaid)}`}>
              <div className="w-full rounded-t bg-forest" style={{ height: `${Math.max(2, (m.cardPaid / peak) * 100)}%` }} />
              <span className="text-[10px] text-muted">{m.month.slice(5)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Card payments by month</p>
      </div>

      <TableShell
        head={
          <tr>
            <th className="px-4 py-2.5">Month</th>
            <th className="px-4 py-2.5 text-right">Card paid</th>
            <th className="px-4 py-2.5 text-right">Platform 5%</th>
            <th className="px-4 py-2.5 text-right">Coach share</th>
            <th className="px-4 py-2.5 text-right">Cash</th>
            <th className="px-4 py-2.5 text-right">Refunded</th>
            <th className="px-4 py-2.5 text-right">Payments</th>
          </tr>
        }
      >
        {rows.map((m) => (
          <tr key={m.month}>
            <td className="px-4 py-3">{monthLabel(m.month)}</td>
            <td className="px-4 py-3 text-right"><Money amount={m.cardPaid} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.platformFee} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.coachShare} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.cash} /></td>
            <td className="px-4 py-3 text-right"><Money amount={m.refunded} /></td>
            <td className="px-4 py-3 text-right tabular-nums">{m.cardCount}</td>
          </tr>
        ))}
      </TableShell>
      <p className="mt-3 text-xs text-muted">
        Amounts come from BookMe's own records, not from Stripe. Stripe's processing fees are not deducted here.
      </p>
    </>
  );
}
