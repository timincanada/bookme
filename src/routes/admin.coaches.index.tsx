import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chip, ExportButtons, Money, TableShell } from "@/components/bookme/admin-ui";
import { Button } from "@/components/ui/button";
import { subscriptionTone } from "@/lib/bookme/admin-console";
import { adminCoaches } from "@/lib/bookme/admin-api";

export const Route = createFileRoute("/admin/coaches/")({ component: Coaches });

type Data = Extract<Awaited<ReturnType<typeof adminCoaches>>, { ok: true }>;
const STATUSES = ["all", "trialing", "active", "lapsed", "banned"] as const;
const SORTS = [
  { key: "recent", label: "Recent activity" },
  { key: "lessons", label: "Lessons" },
  { key: "revenue", label: "Card revenue" },
  { key: "name", label: "Name" },
] as const;

function Coaches() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("recent");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      adminCoaches({ data: { search, status, sort, offset } }).then((r) => {
        if (alive && r.ok) setData(r);
      });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search, status, sort, offset]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-medium">Coaches</h1>
        <ExportButtons kind="coaches" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          className="field"
          placeholder="Search name, email or page"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <select className="field" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setOffset(0); }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <select className="field" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">{data.total} coaches</p>
          <TableShell
            head={
              <tr>
                <th className="px-4 py-2.5">Coach</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Lessons</th>
                <th className="px-4 py-2.5 text-right">Clients</th>
                <th className="px-4 py-2.5 text-right">Card paid</th>
                <th className="px-4 py-2.5 text-right">Platform 5%</th>
                <th className="px-4 py-2.5">Last lesson</th>
              </tr>
            }
          >
            {data.coaches.map((c) => (
              <tr key={c.id} className="hover:bg-paper-2">
                <td className="px-4 py-3">
                  <Link to="/admin/coaches/$id" params={{ id: c.id }} className="font-semibold text-forest">
                    {c.name}
                  </Link>
                  <span className="block text-xs text-muted">{c.specialty}</span>
                  <span className="block text-xs text-muted">{c.email}</span>
                </td>
                <td className="px-4 py-3">
                  <Chip tone={subscriptionTone(c.status, c.banned)}>{c.banned ? "banned" : c.status || "none"}</Chip>
                  {c.accessGrant ? <Chip tone="muted">grant: {c.accessGrant}</Chip> : null}
                  {!c.stripeConnected ? <Chip tone="warn">no Stripe</Chip> : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.lessonsConfirmed}
                  <span className="block text-xs text-muted">{c.lessonsUpcoming} upcoming</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{c.clients}</td>
                <td className="px-4 py-3 text-right">
                  <Money amount={c.cardPaid} />
                  <span className="block text-xs text-muted">
                    cash <Money amount={c.cashCollected} />
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Money amount={c.platformFee} />
                </td>
                <td className="px-4 py-3 text-xs text-muted">{c.lastLessonAt ? c.lastLessonAt.slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </TableShell>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - data.limit))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + data.limit >= data.total}
              onClick={() => setOffset(offset + data.limit)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
