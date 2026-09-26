import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RecurringPlanCard } from "@/components/bookme/recurring-plan-card";
import { Button } from "@/components/ui/button";
import {
  clockValue,
  maxEndDate,
  parseClock,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  WEEKDAY_LONG,
  WEEKDAY_ORDER,
  MAX_SLOTS,
  type RecurringPreview,
  type RecurringRuleInput,
} from "@/lib/bookme/recurring";
import { notifyLessonsChanged } from "@/lib/bookme/lessons-sync";
import { confirmRecurringImport, getImportContext, previewRecurringImport } from "@/lib/bookme/recurring-api";
import { weekdayOf } from "@/lib/bookme/time";

type Search = { client?: string };

export const Route = createFileRoute("/app/import")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: ImportPage,
});

type Ctx = Extract<Awaited<ReturnType<typeof getImportContext>>, { ok: true }>;
type SlotRow = { key: number; weekday: number; time: string; duration: number };

let rowKey = 1;

function ImportPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    getImportContext().then((r) => {
      if (r.ok) setCtx(r);
      else setLoadError(r.error);
    });
  }, []);

  if (loadError) return <div className="p-8 text-muted">{loadError}</div>;
  if (!ctx) return <div className="p-8 text-muted">Loading…</div>;
  return <ImportForm ctx={ctx} initialClient={search.client} onDone={(id) => void navigate({ to: "/app/series/$id", params: { id } })} />;
}

function ImportForm({ ctx, initialClient, onDone }: { ctx: Ctx; initialClient?: string; onDone: (seriesId: string) => void }) {
  const preset = ctx.clients.find((c) => c.id === initialClient);
  const [mode, setMode] = useState<"existing" | "new">(ctx.clients.length ? "existing" : "new");
  const [clientId, setClientId] = useState(preset?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [locationId, setLocationId] = useState(ctx.locations[0]?.id ?? "");
  const [startDate, setStartDate] = useState(ctx.today);
  const [endDate, setEndDate] = useState(ctx.maxEnd);
  const [repeat, setRepeat] = useState<1 | 2>(1);
  const [rows, setRows] = useState<SlotRow[]>(() => [
    { key: rowKey++, weekday: weekdayOf(ctx.today), time: "16:00", duration: ctx.defaultDuration },
  ]);
  const [payStatus, setPayStatus] = useState(preset?.paymentStatus ?? "");
  const [payNote, setPayNote] = useState(preset?.paymentNote ?? "");
  const [paySplit, setPaySplit] = useState(preset?.splitRatio ?? "");
  const [notify, setNotify] = useState(false);
  const [plan, setPlan] = useState<RecurringPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const latestEnd = startDate ? maxEndDate(startDate) : ctx.maxEnd;

  function pickClient(id: string) {
    setClientId(id);
    const c = ctx.clients.find((x) => x.id === id);
    setPayStatus(c?.paymentStatus ?? "");
    setPayNote(c?.paymentNote ?? "");
    setPaySplit(c?.splitRatio ?? "");
  }

  const rule = useMemo((): RecurringRuleInput | null => {
    const slots = rows.map((r) => ({ weekday: r.weekday, startMin: parseClock(r.time), durationMin: r.duration }));
    if (slots.some((s) => s.startMin == null)) return null;
    return {
      client: mode === "existing" ? { kind: "existing", id: clientId } : { kind: "new", name: newName, email: newEmail || null },
      locationId: locationId || null,
      slots: slots.map((s) => ({ weekday: s.weekday, startMin: s.startMin as number, durationMin: s.durationMin })),
      startDate,
      endDate,
      intervalWeeks: repeat,
      payment: { status: payStatus || null, note: payNote, split: paySplit },
      notifyStudent: notify,
    };
  }, [rows, mode, clientId, newName, newEmail, locationId, startDate, endDate, repeat, payStatus, payNote, paySplit, notify]);

  // Any edit invalidates the card on screen.
  useEffect(() => {
    setPlan(null);
    setNotice("");
  }, [rule]);

  async function preview() {
    setError("");
    if (!rule) return setError("Enter a start time for every weekday.");
    setBusy(true);
    const res = await previewRecurringImport({ data: { rule } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPlan(res.preview);
  }

  async function confirm() {
    if (!rule || !plan) return;
    setBusy(true);
    setError("");
    const res = await confirmRecurringImport({ data: { rule, fingerprint: plan.fingerprint } });
    setBusy(false);
    if (res.ok) {
      notifyLessonsChanged("import");
      return onDone(res.seriesId);
    }
    if (res.preview) {
      setPlan(res.preview);
      setNotice(res.error);
      return;
    }
    setError(res.error);
  }

  function updateRow(key: number, patch: Partial<SlotRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  if (!ctx.open) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Header />
        <p className="mt-6 rounded-2xl bg-sage-3 p-4 text-sm text-forest">
          Finish setup and keep your trial or plan active to import lessons.{" "}
          <Link to="/app/setup" className="font-semibold underline">
            Open setup
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Header />

      <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="font-semibold">Client</h2>
        <div className="mt-3 flex gap-2">
          {ctx.clients.length ? (
            <ModeButton on={mode === "existing"} onClick={() => setMode("existing")}>
              Existing client
            </ModeButton>
          ) : null}
          <ModeButton on={mode === "new"} onClick={() => setMode("new")}>
            New client
          </ModeButton>
        </div>
        {mode === "existing" ? (
          <select className="field mt-3" value={clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">Choose a client…</option>
            {ctx.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` · ${c.email}` : " · no email"}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Name</span>
              <input className="field" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Email (strongly recommended)</span>
              <input className="field" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </label>
            {!newEmail.trim() ? (
              <p className="text-sm text-muted sm:col-span-2">Without an email the student can't use the portal or messages.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="font-semibold">Weekly times</h2>
        <p className="mt-1 text-sm text-muted">Add each weekday and time. Times are in {ctx.timezone}.</p>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="grid grid-cols-[1fr_7rem_6.5rem_auto] items-center gap-2">
              <select
                className="field"
                aria-label="Weekday"
                value={r.weekday}
                onChange={(e) => updateRow(r.key, { weekday: Number(e.target.value) })}
              >
                {WEEKDAY_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_LONG[d]}
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="time"
                step={300}
                aria-label="Start time"
                value={r.time}
                onChange={(e) => updateRow(r.key, { time: e.target.value })}
              />
              <select
                className="field"
                aria-label="Length"
                value={r.duration}
                onChange={(e) => updateRow(r.key, { duration: Number(e.target.value) })}
              >
                {ctx.durations.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Remove time"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="grid size-11 place-items-center rounded-full text-muted hover:bg-paper-2 disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={rows.length >= MAX_SLOTS}
          onClick={() => {
            const last = rows[rows.length - 1];
            setRows((rs) => [
              ...rs,
              {
                key: rowKey++,
                weekday: last ? (last.weekday + 1) % 7 : 1,
                time: last?.time ?? clockValue(16 * 60),
                duration: ctx.defaultDuration,
              },
            ]);
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest disabled:text-line"
        >
          <Plus className="size-4" /> Add a time
        </button>
        {rows.length >= MAX_SLOTS ? <p className="mt-1 text-xs text-muted">Up to {MAX_SLOTS} times per schedule.</p> : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Repeats</span>
            <select className="field" value={repeat} onChange={(e) => setRepeat(Number(e.target.value) === 2 ? 2 : 1)}>
              <option value={1}>Every week</option>
              <option value={2}>Every 2 weeks</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Starts</span>
            <input
              className="field"
              type="date"
              min={ctx.today}
              value={startDate}
              onChange={(e) => {
                const v = e.target.value;
                setStartDate(v);
                if (v && endDate > maxEndDate(v)) setEndDate(maxEndDate(v));
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Ends (included)</span>
            <input
              className="field"
              type="date"
              min={startDate}
              max={latestEnd}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">At most 6 months after the start ({latestEnd}). Every 2 weeks counts from the start date's week.</p>
        {ctx.locations.length > 1 ? (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium">Location</span>
            <select className="field" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {ctx.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="font-semibold">Payment note</h2>
        <p className="mt-1 text-sm text-muted">For your records only. No charge is created. Starts from the client's note; changes here apply to this schedule.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Status</span>
            <select className="field" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
              <option value="">No status</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Split (optional)</span>
            <input className="field" value={paySplit} onChange={(e) => setPaySplit(e.target.value)} placeholder="Parent 70% / venue separate" />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium">Note</span>
          <input className="field" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="6 of 10 paid · e-transfer" />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Email the student that these lessons were added
        </label>
      </section>

      {error ? <p className="mt-4 text-sm font-semibold text-coral">{error}</p> : null}

      {plan ? (
        <div className="mt-6">
          {notice ? <p className="mb-3 rounded-xl bg-sage-3 px-3 py-2 text-sm font-semibold text-forest">{notice}</p> : null}
          <RecurringPlanCard plan={plan} busy={busy} onConfirm={() => void confirm()} onCancel={() => setPlan(null)} />
        </div>
      ) : (
        <Button className="mt-6 w-full" size="field" disabled={busy} onClick={() => void preview()}>
          Preview import
        </Button>
      )}
    </div>
  );
}

function Header() {
  return (
    <>
      <Link to="/app" className="type-action text-sm font-semibold text-forest">
        Schedule
      </Link>
      <h1 className="type-page mt-3 font-display text-3xl font-medium">Import recurring schedule</h1>
      <p className="mt-1 text-muted">Add an existing student's regular lessons. Nothing is saved until you confirm.</p>
    </>
  );
}

function ModeButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={on ? "rounded-full bg-forest px-4 py-2 text-sm text-on-forest" : "rounded-full px-4 py-2 text-sm ring-1 ring-line"}
    >
      {children}
    </button>
  );
}
