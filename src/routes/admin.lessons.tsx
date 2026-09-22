import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip, ExportButtons, Money, TableShell } from "@/components/bookme/admin-ui";
import { adminLessons } from "@/lib/bookme/admin-api";
import { addDaysKey, todayKey } from "@/lib/bookme/time";
import { REPORT_TIMEZONE } from "@/lib/bookme/admin-console";

export const Route = createFileRoute("/admin/lessons")({ component: Lessons });

type Data = Extract<Awaited<ReturnType<typeof adminLessons>>, { ok: true }>;
const STATUSES = ["all", "confirmed", "cancelled", "held", "expired", "completed"];
const ANOMALY_LABELS: Record<string, string> = {
  stuckHolds: "Holds stuck in 'held' over a day",
  missingPayment: "Confirmed lessons with no payment row",
  paidButCancelled: "Cancelled lessons still marked paid",
  refundedButConfirmed: "Confirmed lessons marked refunded",
};

function Lessons() {
  const today = todayKey(REPORT_TIMEZONE);
  const [from, setFrom] = useState(addDaysKey(today, -29));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    adminLessons({ data: { from, to, status } }).then((r) => {
      if (alive && r.ok) setData(r);
    });
    return () => {
      alive = false;
    };
  }, [from, to, status]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-medium">Lessons</h1>
        <ExportButtons kind="lessons" from={from} to={to} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">From</span>
          <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">To</span>
          <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Status</span>
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(data.anomalies).map(([k, v]) =>
              v > 0 ? (
                <Chip key={k} tone="warn">
                  {ANOMALY_LABELS[k] ?? k}: {v}
                </Chip>
              ) : null,
            )}
            {Object.values(data.anomalies).every((v) => v === 0) ? <Chip tone="good">No data anomalies</Chip> : null}
          </div>

          <TableShell
            head={
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Coach</th>
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            }
          >
            {data.lessons.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-xs tabular-nums">
                  {new Date(l.startAt).toLocaleString("en-CA", { timeZone: REPORT_TIMEZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3">
                  <Link to="/admin/coaches/$id" params={{ id: l.coachId }} className="font-semibold text-forest">
                    {l.coachName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{l.student}</td>
                <td className="px-4 py-3">
                  <Chip tone={l.status === "cancelled" ? "bad" : l.status === "confirmed" ? "good" : "muted"}>{l.status}</Chip>
                  {l.source === "imported_recurring" ? <Chip tone="muted">recurring</Chip> : null}
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.payMethod || "—"} · {l.payStatus || "—"}
                </td>
                <td className="px-4 py-3 text-right"><Money amount={l.amountCad} /></td>
              </tr>
            ))}
            {data.lessons.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted" colSpan={6}>
                  No lessons in this range.
                </td>
              </tr>
            ) : null}
          </TableShell>
          <p className="mt-3 text-xs text-muted">Students are shown anonymously. Use Lookup for a specific booking enquiry.</p>
        </>
      )}
    </>
  );
}
