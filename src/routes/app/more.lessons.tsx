import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DurationPriceList } from "@/components/bookme/price-input";
import { Button } from "@/components/ui/button";
import { saveCoachLesson } from "@/lib/bookme/api";
import { useCoach } from "@/lib/bookme/coach-context";
import { lessonCatalogLines } from "@/lib/bookme/lesson-catalog";
import { durationPricesFromInputs, initialPriceInputs, prefillDurationPrice } from "@/lib/bookme/price-input";
import { DURATIONS } from "@/lib/bookme/setup";
import { cn } from "@/lib/utils";

type Search = { edit?: string };

export const Route = createFileRoute("/app/more/lessons")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    edit: typeof s.edit === "string" && s.edit ? s.edit : undefined,
  }),
  component: LessonsPage,
});

function LessonsPage() {
  const { coach, reload } = useCoach();
  const { edit } = Route.useSearch();
  if (!coach) return null;

  const editing = edit ? coach.services.find((service) => service.id === edit) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="type-action text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="mt-3 font-display text-3xl font-medium">Lessons</h1>
      <p className="mt-2 text-muted">Duration and price for each lesson length.</p>
      {edit ? (
        editing ? (
          <LessonEditor key={editing.id} service={editing} onSaved={reload} />
        ) : (
          <p className="mt-6 text-sm text-muted">That lesson is not on your account.</p>
        )
      ) : coach.services.length === 0 ? (
        <div className="mt-8">
          <p className="text-muted">No lessons yet.</p>
          <Button asChild className="mt-4" size="field">
            <Link to="/app/setup">Set up lessons</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {coach.services.map((service) => {
            const row = lessonCatalogLines(service);
            return (
              <li key={service.id}>
                <Link
                  to="/app/more/lessons"
                  search={{ edit: service.id }}
                  className="block rounded-2xl bg-card p-4 ring-1 ring-line hover:bg-paper"
                >
                  <p className="type-key font-semibold">{row.name}</p>
                  <ul className="mt-1 space-y-0.5">
                    {row.lines.map((line) => (
                      <li key={line} className="type-key text-sm text-muted max-md:text-ink">
                        {line}
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LessonEditor({
  service,
  onSaved,
}: {
  service: {
    id: string;
    name: string;
    duration: number;
    durations: number[];
    priceCad: number;
    durationPrices?: Record<string, number> | null;
  };
  onSaved: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const initial = lessonCatalogLines(service);
  const [durations, setDurations] = useState<number[]>(() =>
    service.durations.length ? [...service.durations].sort((a, b) => a - b) : [service.duration || 60],
  );
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    initialPriceInputs(
      service.durations.length ? [...service.durations].sort((a, b) => a - b) : [service.duration || 60],
      service,
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const priced = durationPricesFromInputs(durations, prices);
    if (!priced) {
      setBusy(false);
      setError("Enter a price");
      return;
    }
    const res = await saveCoachLesson({
      data: { id: service.id, durations, priceCad: priced.priceCad, durationPrices: priced.durationPrices },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await onSaved();
    void navigate({ to: "/app/more/lessons", search: { edit: undefined } });
  }

  return (
    <div className="mt-6">
      <Link to="/app/more/lessons" search={{ edit: undefined }} className="type-action text-sm font-semibold text-forest">
        All lessons
      </Link>
      <h2 className="type-section mt-3 font-display text-2xl font-medium">{initial.name}</h2>
      <p className="mt-4 text-sm font-medium">Duration</p>
      <p className="mt-1 text-sm text-muted">Select one or more lesson lengths students can book.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DURATIONS.map((d) => {
          const on = durations.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPrices((prev) => {
                  if (durations.includes(d)) return prev;
                  if (prev[d]) return prev;
                  return { ...prev, [d]: prefillDurationPrice(prev, durations) };
                });
                setDurations((prev) => {
                  if (prev.includes(d)) {
                    if (prev.length === 1) return prev;
                    return prev.filter((x) => x !== d);
                  }
                  return [...prev, d].sort((a, b) => a - b);
                });
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm ring-1",
                on ? "bg-forest text-on-forest ring-forest" : "ring-line",
              )}
            >
              {d} min
            </button>
          );
        })}
      </div>
      <DurationPriceList
        durations={durations}
        prices={prices}
        onChange={(minutes, value) => setPrices((prev) => ({ ...prev, [minutes]: value }))}
      />
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <Button
        className="mt-6"
        size="field"
        disabled={busy || durations.length === 0 || !durationPricesFromInputs(durations, prices)}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
