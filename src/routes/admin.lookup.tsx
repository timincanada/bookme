import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Chip, Money, TableShell } from "@/components/bookme/admin-ui";
import { Button } from "@/components/ui/button";
import { adminLookupStudent } from "@/lib/bookme/admin-api";
import { REPORT_TIMEZONE } from "@/lib/bookme/admin-console";

export const Route = createFileRoute("/admin/lookup")({ component: Lookup });

type Result = Extract<Awaited<ReturnType<typeof adminLookupStudent>>, { ok: true }>;

function Lookup() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    const res = await adminLookupStudent({ data: { email, note } });
    setBusy(false);
    if (!res.ok) {
      setResult(null);
      return setError(res.error);
    }
    setResult(res);
  }

  return (
    <>
      <h1 className="font-display text-3xl font-medium">Student lookup</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        For support enquiries only. Returns that student's bookings — never coach notes, payment notes or messages. Every
        lookup is recorded with your email and the note below.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="field" type="email" placeholder="student@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field" placeholder="Reason (e.g. refund request #123)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="field" disabled={busy || !email.trim()} onClick={() => void run()}>
          Look up
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-coral">{error}</p> : null}

      {result ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl">{result.email}</h2>
            <Chip tone={result.hasPortalAccount ? "good" : "muted"}>
              {result.hasPortalAccount ? "portal account" : "no portal account"}
            </Chip>
            {result.lastLoginAt ? <Chip tone="muted">last sign-in {result.lastLoginAt.slice(0, 10)}</Chip> : null}
          </div>
          <TableShell
            head={
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Coach</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            }
          >
            {result.lessons.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-xs tabular-nums">
                  {new Date(l.startAt).toLocaleString("en-CA", { timeZone: REPORT_TIMEZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3">
                  <Link to="/admin/coaches/$id" params={{ id: l.coachId }} className="font-semibold text-forest">
                    {l.coachName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Chip tone={l.status === "cancelled" ? "bad" : l.status === "confirmed" ? "good" : "muted"}>{l.status}</Chip>
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.payMethod || "—"} · {l.payStatus || "—"}
                </td>
                <td className="px-4 py-3 text-right"><Money amount={l.amountCad} /></td>
              </tr>
            ))}
            {result.lessons.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted" colSpan={5}>
                  No bookings for that email.
                </td>
              </tr>
            ) : null}
          </TableShell>
        </>
      ) : null}
    </>
  );
}
