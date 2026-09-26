import { createFileRoute, Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PayChip, StatusChip } from "@/components/bookme/pay-chip";
import { Button } from "@/components/ui/button";
import { notifyLessonsChanged, useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUSES } from "@/lib/bookme/recurring";
import { endRecurringSeries, getSeries, updateSeriesPayment } from "@/lib/bookme/recurring-api";

export const Route = createFileRoute("/app/series/$id")({ component: SeriesPage });

type Data = Extract<Awaited<ReturnType<typeof getSeries>>, { ok: true }>;

function SeriesPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paySplit, setPaySplit] = useState("");
  const [payMsg, setPayMsg] = useState("");
  const [endFrom, setEndFrom] = useState("");
  const [notify, setNotify] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const gen = useRef(0);
  const formsReady = useRef(false);
  const seen = useRef(false);

  function load(forms = false) {
    const my = ++gen.current;
    const fill = forms || !formsReady.current;
    return getSeries({ data: { id } }).then((r) => {
      if (my !== gen.current) return;
      if (!r.ok) {
        if (!seen.current) setError(r.error);
        return;
      }
      seen.current = true;
      setError("");
      setData(r);
      if (fill) {
        formsReady.current = true;
        setPayStatus(r.series.paymentStatus ?? "");
        setPayNote(r.series.paymentNote);
        setPaySplit(r.series.splitRatio);
      }
      setEndFrom((v) => v || r.series.today);
    });
  }

  useLessonsRefresh(() => {
    void load(false);
  });

  useEffect(() => {
    formsReady.current = false;
    seen.current = false;
    setError("");
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="p-8 text-muted">{error}</div>;
  if (!data) return <div className="p-8 text-muted">Loading…</div>;
  const s = data.series;
  const upcoming = data.lessons.filter((l) => l.upcoming);
  const past = data.lessons.filter((l) => !l.upcoming);
  const active = s.status === "active";

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/clients/$id" params={{ id: s.clientId }} className="text-sm font-semibold text-forest">
        {s.clientName}
      </Link>
      <h1 className="mt-3 flex items-center gap-2 font-display text-3xl font-medium">
        <Repeat className="size-6 text-forest" strokeWidth={1.5} />
        Recurring schedule
      </h1>
      <div className="mt-4 rounded-2xl bg-card p-5 ring-1 ring-line">
        <p className="font-semibold">
          {s.clientName} <span className="font-normal text-muted">· {s.clientEmail || "no email"}</span>
        </p>
        <p className="mt-1 text-sm">
          <StatusChip>{active ? "Active" : `Ended from ${s.endedFrom}`}</StatusChip>
        </p>
        <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted">Times</dt>
          <dd>
            {s.slots.map((t) => (
              <span key={t} className="block tabular-nums">
                {t}
              </span>
            ))}
          </dd>
          <dt className="text-muted">Repeats</dt>
          <dd>{s.repeat}</dd>
          <dt className="text-muted">Dates</dt>
          <dd>
            {s.startLabel} – {s.endLabel}
          </dd>
          <dt className="text-muted">Location</dt>
          <dd>{s.locationName}</dd>
          <dt className="text-muted">Time zone</dt>
          <dd>{s.timezone}</dd>
          <dt className="text-muted">Imported</dt>
          <dd>
            {s.lessonCount} created · {s.skippedCount} skipped · via {s.createdVia === "assistant" ? "assistant" : "form"}
          </dd>
        </dl>
      </div>

      <section className="mt-4 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="font-semibold">Payment note for this schedule</h2>
        <p className="mt-1 text-sm text-muted">For your records only. The client's own note is separate.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select className="field" value={payStatus} onChange={(e) => setPayStatus(e.target.value)} aria-label="Status">
            <option value="">No status</option>
            {PAYMENT_STATUSES.map((p) => (
              <option key={p} value={p}>
                {PAYMENT_STATUS_LABEL[p]}
              </option>
            ))}
          </select>
          <input className="field" value={paySplit} onChange={(e) => setPaySplit(e.target.value)} placeholder="Split (optional)" aria-label="Split" />
        </div>
        <input className="field mt-3" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note" aria-label="Note" />
        <Button
          className="mt-3"
          size="field"
          onClick={async () => {
            const res = await updateSeriesPayment({ data: { id, status: payStatus || null, note: payNote, split: paySplit } });
            setPayMsg(res.ok ? "Saved" : res.error);
            if (res.ok) void load(true);
          }}
        >
          Save payment note
        </Button>
        {payMsg ? <p className="mt-2 text-sm text-forest">{payMsg}</p> : null}
      </section>

      <LessonList title={`Upcoming (${upcoming.length})`} lessons={upcoming} />
      <LessonList title={`Past (${past.length})`} lessons={past} />

      {active ? (
        <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
          <h2 className="font-semibold">End this schedule</h2>
          <p className="mt-1 text-sm text-muted">
            Confirmed lessons from this date on are cancelled. Earlier lessons stay. To cancel a single lesson, open it instead.
          </p>
          <input
            className="field mt-3"
            type="date"
            min={s.today}
            value={endFrom}
            onChange={(e) => {
              setEndFrom(e.target.value);
              setConfirmEnd(false);
            }}
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={!s.clientEmail} />
            Email the student {s.clientEmail ? "" : "(no email on file)"}
          </label>
          {confirmEnd ? (
            <div className="mt-3 rounded-xl bg-paper-2 p-3 text-sm">
              <p>
                Cancel {upcoming.filter((l) => l.status === "confirmed").length ? "the remaining" : "any"} confirmed lessons from {endFrom}?
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="field"
                  className="bg-coral hover:bg-coral/90"
                  disabled={busy || !endFrom}
                  onClick={async () => {
                    setBusy(true);
                    const res = await endRecurringSeries({ data: { id, fromDate: endFrom, notify } });
                    setBusy(false);
                    setConfirmEnd(false);
                    setMsg(res.ok ? `Schedule ended. ${res.cancelled} lesson${res.cancelled === 1 ? "" : "s"} cancelled.` : res.error);
                    if (res.ok) {
                      notifyLessonsChanged("series");
                      void load(true);
                    }
                  }}
                >
                  End schedule
                </Button>
                <Button variant="outline" size="field" disabled={busy} onClick={() => setConfirmEnd(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="mt-3 text-coral" size="field" disabled={!endFrom} onClick={() => setConfirmEnd(true)}>
              End from this date
            </Button>
          )}
        </section>
      ) : null}
      {msg ? <p className="mt-4 text-sm text-ink-soft">{msg}</p> : null}
    </div>
  );
}

function LessonList({ title, lessons }: { title: string; lessons: Data["lessons"] }) {
  if (!lessons.length) return null;
  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <ul className="mt-3 space-y-2">
        {lessons.map((l) => (
          <li key={l.id}>
            <Link
              to="/app/lessons/$id"
              params={{ id: l.id }}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card p-3 text-sm ring-1 ring-line"
            >
              <span className="type-primary tabular-nums">{l.when}</span>
              <span className="flex items-center gap-2">
                <StatusChip>{l.statusLabel}</StatusChip>
                <PayChip kind={l.pay.kind} text={l.pay.text} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
