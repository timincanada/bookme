import { createFileRoute, Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import { MessageLink } from "@/components/bookme/message-link";
import { Button } from "@/components/ui/button";
import { getMyClient, saveClientNote } from "@/lib/bookme/api";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUSES } from "@/lib/bookme/recurring";
import { listClientSeries, saveClientPayment } from "@/lib/bookme/recurring-api";

export const Route = createFileRoute("/app/clients/$id")({ component: ClientDetail });

function ClientDetail() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof getMyClient>>, { ok: true }> | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");
  const [series, setSeries] = useState<Extract<Awaited<ReturnType<typeof listClientSeries>>, { ok: true }>["series"]>([]);
  const [payStatus, setPayStatus] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySplit, setPaySplit] = useState("");
  const [paySaved, setPaySaved] = useState("");

  useEffect(() => {
    getMyClient({ data: { id } }).then((r) => {
      if (r.ok) {
        setData(r);
        setNote(r.client.note);
      }
    });
    listClientSeries({ data: { clientId: id } }).then((r) => {
      if (!r.ok) return;
      setSeries(r.series);
      setPayStatus(r.payment.status ?? "");
      setPayNote(r.payment.note);
      setPaySplit(r.payment.split);
    });
  }, [id]);

  if (!data) return <div className="p-8 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/clients" className="text-sm font-semibold text-forest">
        Clients
      </Link>
      <h1 className="mt-3 font-display text-3xl font-medium">{data.client.name}</h1>
      <p className="text-muted">{data.client.email || "No email — this student can't use the portal or messages."}</p>
      <MessageLink clientId={id} />
      <Button variant="outline" size="field" className="mt-4" asChild>
        <Link to="/app/import" search={{ client: id }}>
          <Repeat className="mr-1.5 size-4" strokeWidth={1.75} />
          Import recurring schedule
        </Link>
      </Button>
      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium">One note about this client</span>
        <textarea className="field h-28 py-3" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button
        className="mt-3"
        onClick={async () => {
          await saveClientNote({ data: { id, note } });
          setSaved("Saved");
        }}
      >
        Save note
      </Button>
      {saved ? <p className="mt-2 text-sm text-forest">{saved}</p> : null}
      <h2 className="mt-10 font-display text-2xl">Payment note</h2>
      <p className="mt-1 text-sm text-muted">
        For your records only — no charges. New recurring schedules start from this; existing schedules keep their own note.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select className="field" aria-label="Payment status" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="">No status</option>
          {PAYMENT_STATUSES.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_STATUS_LABEL[p]}
            </option>
          ))}
        </select>
        <input className="field" aria-label="Split" placeholder="Split (optional)" value={paySplit} onChange={(e) => setPaySplit(e.target.value)} />
      </div>
      <input className="field mt-3" aria-label="Payment note" placeholder="Note" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
      <Button
        className="mt-3"
        onClick={async () => {
          const res = await saveClientPayment({ data: { clientId: id, status: payStatus || null, note: payNote, split: paySplit } });
          setPaySaved(res.ok ? "Saved" : res.error);
        }}
      >
        Save payment note
      </Button>
      {paySaved ? <p className="mt-2 text-sm text-forest">{paySaved}</p> : null}
      {series.length ? (
        <>
          <h2 className="mt-10 font-display text-2xl">Recurring schedules</h2>
          <ul className="mt-3 space-y-2">
            {series.map((sr) => (
              <li key={sr.id}>
                <Link to="/app/series/$id" params={{ id: sr.id }} className="block rounded-xl bg-card p-3 text-sm ring-1 ring-line">
                  <p className="font-semibold">
                    {sr.repeat} · {sr.slots.join(", ")}
                  </p>
                  <p className="text-muted">
                    {sr.dates} · {sr.status === "active" ? "Active" : "Ended"} · {sr.paymentLabel}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h2 className="mt-10 font-display text-2xl">Lesson history</h2>
      <ul className="mt-3 space-y-2">
        {data.lessons.map((l) => (
          <li key={l.id} className="rounded-xl bg-card p-3 text-sm ring-1 ring-line">
            {l.when} · {l.locationName} · {l.statusLabel}
            {l.recurring ? " · Recurring" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
