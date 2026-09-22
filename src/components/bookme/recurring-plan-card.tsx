import { AlertTriangle, Repeat } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LARGE_IMPORT, repeatLabel, type RecurringPreview } from "@/lib/bookme/recurring";
import { cn } from "@/lib/utils";

const SKIP_PREVIEW = 10;

export function RecurringPlanCard({
  plan,
  onConfirm,
  onCancel,
  busy = false,
  confirmLabel,
  cancelLabel = "Edit",
}: {
  plan: RecurringPreview;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const skipped = showAll ? plan.skipped : plan.skipped.slice(0, SKIP_PREVIEW);
  const n = plan.createCount;
  const label = confirmLabel || `Import ${n} lesson${n === 1 ? "" : "s"}`;

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-line" aria-label="Confirm import">
      <div className="px-5 pt-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          <Repeat className="size-3.5" strokeWidth={2} />
          Import recurring schedule
        </p>
        <h2 className="mt-2 font-display text-2xl font-medium">{plan.client.name}</h2>
        <p className="text-sm text-muted">
          {plan.client.email || "No email"} · {plan.client.mode === "existing" ? "Existing client" : "New client"}
        </p>
        {!plan.client.email ? (
          <p className="mt-3 flex gap-2 rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.75} />
            No email: this student can't sign in to the student portal or use messages, and gets no reminders.
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted">Location</dt>
          <dd>{plan.location.name}</dd>
          <dt className="text-muted">Time zone</dt>
          <dd>{plan.timezone}</dd>
          <dt className="text-muted">Dates</dt>
          <dd>
            {plan.startLabel} – {plan.endLabel}
          </dd>
          <dt className="text-muted">Repeats</dt>
          <dd>{repeatLabel(plan.intervalWeeks)}</dd>
        </dl>

        <p className="mt-4 text-sm font-semibold">Weekly times</p>
        <ul className="mt-1.5 space-y-1 text-sm">
          {plan.slots.map((s) => (
            <li key={`${s.weekday}-${s.startMin}`} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium tabular-nums">{s.label}</span>
              <span className="text-muted">{s.durationMin} min</span>
              {s.durationChanged ? <span className="text-xs font-semibold text-forest">Length changed for this import</span> : null}
              {s.outsideHours ? <span className="text-xs font-semibold text-coral">Outside public hours</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-y border-line bg-cream px-5 py-4">
        <p className="font-display text-xl">
          Will create <span className="font-semibold">{plan.createCount}</span> · Skip{" "}
          <span className="font-semibold">{plan.skipCount}</span>
        </p>
        {plan.createCount > LARGE_IMPORT ? (
          <p className="mt-1 text-sm font-semibold text-forest">
            This import adds {plan.createCount} lessons to your calendar.
          </p>
        ) : null}
        {plan.skipped.length ? (
          <>
            <p className="mt-3 text-sm font-semibold">Skipped dates</p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {skipped.map((s) => (
                <li key={`${s.dateKey}-${s.slotLabel}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <span className="tabular-nums">
                    {s.dateLabel} · {s.slotLabel.split(" ").slice(1).join(" ")}
                  </span>
                  <span className="text-right text-muted">{s.detail}</span>
                </li>
              ))}
            </ul>
            {plan.skipped.length > SKIP_PREVIEW ? (
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-forest"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show fewer" : `Show all ${plan.skipped.length}`}
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="space-y-2 px-5 py-4 text-sm">
        {plan.outsideHours ? (
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.75} />
            Not in your public hours — these times will still hold the slot.
          </p>
        ) : null}
        {plan.activeSeriesCount ? (
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.75} />
            This client already has {plan.activeSeriesCount} active recurring schedule
            {plan.activeSeriesCount === 1 ? "" : "s"}. Overlapping dates are skipped.
          </p>
        ) : null}
        <p>
          <span className="text-muted">Payment note: </span>
          {[plan.payment.status ? plan.payment.statusLabel : "", plan.payment.note, plan.payment.split].filter(Boolean).join(" · ") ||
            "None"}
        </p>
        <p className="text-muted">No Stripe charge will be created.</p>
        <p className="text-muted">
          Student {plan.notifyStudent ? "will" : "won't"} be emailed · 24h/2h reminders{" "}
          {plan.remindersOn ? "on" : "off (no email)"}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row-reverse">
        <Button size="field" disabled={busy || plan.createCount === 0} onClick={onConfirm} className="sm:flex-1">
          {plan.createCount === 0 ? "Nothing to import" : label}
        </Button>
        <Button variant="outline" size="field" disabled={busy} onClick={onCancel} className={cn("sm:flex-1")}>
          {cancelLabel}
        </Button>
      </div>
    </section>
  );
}
