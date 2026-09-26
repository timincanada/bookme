import { createFileRoute, Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageLink } from "@/components/bookme/message-link";
import { Button } from "@/components/ui/button";
import { LessonScan, lessonInstantParts } from "@/components/bookme/lesson-scan";
import { getMyClient, saveClientNote } from "@/lib/bookme/api";
import { useCoach } from "@/lib/bookme/coach-context";
import { DEFAULT_TIMEZONE } from "@/lib/bookme/timezone";
import { useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUSES } from "@/lib/bookme/recurring";
import { listClientSeries, saveClientPayment } from "@/lib/bookme/recurring-api";

export const Route = createFileRoute("/app/clients/$id")({ component: ClientDetail });

function ClientDetail() {
  const { id } = Route.useParams();
  const { coach } = useCoach();
  const tz = coach?.timezone || DEFAULT_TIMEZONE;
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof getMyClient>>, { ok: true }> | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");
  const [series, setSeries] = useState<Extract<Awaited<ReturnType<typeof listClientSeries>>, { ok: true }>["series"]>([]);
  const [payStatus, setPayStatus] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySplit, setPaySplit] = useState("");
  const [paySaved, setPaySaved] = useState("");
  const gen = useRef(0);
  const noteReady = useRef(false);
  const payReady = useRef(false);

  function reload() {
    const my = ++gen.current;
    const clientId = id;
    const fillNote = !noteReady.current;
    const fillPay = !payReady.current;
    getMyClient({ data: { id: clientId } }).then((r) => {
      if (my !== gen.current || !r.ok) return;
      setData(r);
      if (!fillNote) return;
      noteReady.current = true;
      setNote(r.client.note);
    });
    listClientSeries({ data: { clientId } }).then((r) => {
      if (my !== gen.current || !r.ok) return;
      setSeries(r.series);
      if (!fillPay) return;
      payReady.current = true;
      setPayStatus(r.payment.status ?? "");
      setPayNote(r.payment.note);
      setPaySplit(r.payment.split);
    });
  }

  useLessonsRefresh(reload);

  useEffect(() => {
    noteReady.current = false;
    payReady.current = false;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <div className="p-8 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/clients" className="type-action text-sm font-semibold text-forest">
        Clients
      </Link>
      <h1 className="mt-3 break-words font-display text-3xl font-medium">{data.client.name}</h1>
      <p className="type-secondary max-md:mt-2 break-words text-muted">{data.client.email || "No email — this student can't use the portal or messages."}</p>
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
      <h2 className="type-section mt-10 font-display text-2xl">Payment note</h2>
      <p className="mt-1 text-sm text-muted">
        For your records only — no charges. New recurring schedules start from this; existing schedules keep their own note.
      </p>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <select className="field min-w-0 max-w-full" aria-label="Payment status" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
          <option value="">No status</option>
          {PAYMENT_STATUSES.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_STATUS_LABEL[p]}
            </option>
          ))}
        </select>
        <input className="field min-w-0 max-w-full" aria-label="Split" placeholder="Split (optional)" value={paySplit} onChange={(e) => setPaySplit(e.target.value)} />
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
          <h2 className="type-section mt-10 font-display text-2xl">Recurring schedules</h2>
          <ul className="mt-3 space-y-2">
            {series.map((sr) => (
              <li key={sr.id}>
                <Link to="/app/series/$id" params={{ id: sr.id }} className="block rounded-xl bg-card p-3 text-sm ring-1 ring-line">
                  <p className="type-key break-words font-semibold">
                    {sr.repeat} · {sr.slots.join(", ")}
                  </p>
                  <p className="type-secondary break-words text-muted">
                    {sr.dates} · {sr.status === "active" ? "Active" : "Ended"} · {sr.paymentLabel}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h2 className="type-section mt-10 font-display text-2xl">Lesson history</h2>
      <ul className="mt-3 space-y-2">
        {data.lessons.map((l) => {
          const parts = lessonInstantParts(l.start, tz);
          return (
            <li key={l.id} className="type-primary break-words rounded-xl bg-card p-3 text-sm ring-1 ring-line">
              <span className="contents max-md:hidden">
                {l.when} · {l.locationName} · {l.statusLabel}
                {l.recurring ? " · Recurring" : ""}
              </span>
              <LessonScan
                label={l.statusLabel}
                time={parts.time}
                name={data.client.name}
                date={parts.date}
                location={l.locationName}
                extra={l.recurring ? <p className="type-meta mt-1 text-forest">Recurring</p> : null}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
