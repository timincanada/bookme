import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SportIcon } from "@/components/sport-icon";
import { SPORTS, type FindFilter, labelForSport } from "@/lib/coaches";
import { listPublicCoaches } from "@/lib/bookme/api";
import { asSport } from "@/lib/bookme/sport";
import { groupForVertical } from "@/lib/bookme/verticals";
import { listedFromPrice } from "@/lib/bookme/duration-prices";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Public coach directory. Paused for v1 — BookMe is a coach-owned booking
 * page, not a marketplace. Flip this (and restore the nav link) when there
 * are enough coaches to browse.
 */
export const FIND_DIRECTORY_LIVE = false;

export const Route = createFileRoute("/find")({
  beforeLoad: () => {
    if (!FIND_DIRECTORY_LIVE) throw redirect({ to: "/" });
  },
  component: Find,
});

function Find() {
  const [sport, setSport] = useState<FindFilter>("all");
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Awaited<ReturnType<typeof listPublicCoaches>>>([]);

  useEffect(() => {
    listPublicCoaches().then(setAll);
  }, []);

  const coaches = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((c) => {
      const s = asSport(c.sport);
      if (sport !== "all" && groupForVertical(s)?.id !== sport) return false;
      if (!query) return true;
      const label = labelForSport(s).toLowerCase();
      return (
        c.name.toLowerCase().includes(query) ||
        c.city.toLowerCase().includes(query) ||
        label.includes(query)
      );
    });
  }, [all, sport, q]);

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Find a coach</p>
        <h1 className="mt-3 font-display text-4xl font-medium">Book a lesson this week</h1>
        <p className="mt-3 max-w-xl text-ink-soft">Independent coaches across the GTA. Pick a category, open a page, choose a time.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or city"
            className="type-input h-12 flex-1 rounded-xl border border-line bg-card px-4 text-sm outline-none ring-forest/30 focus:ring-2"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSport(s.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium ring-1",
                sport === s.id ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper-2",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-10 sm:px-8 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => {
          const s = asSport(c.sport);
          const price = listedFromPrice(c.services);
          return (
            <Link
              key={c.slug}
              to="/$slug"
              params={{ slug: c.slug }}
              className="overflow-hidden rounded-2xl bg-card ring-1 ring-line transition hover:shadow-card"
            >
              {c.photoUrl ? (
                <img src={c.photoUrl} alt="" className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-sage-3 font-display text-5xl text-forest">
                  {c.name.slice(0, 1)}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-forest">
                  <SportIcon sport={s} className="size-4" />
                  {labelForSport(s)}
                </div>
                <h2 className="mt-1 font-display text-2xl font-medium">{c.name}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="size-3.5" />
                  {c.city}
                </p>
                <p className="mt-3 text-sm font-semibold">{price ? `From ${formatMoney(price).replace(".00", "")}` : "Book a lesson"}</p>
              </div>
            </Link>
          );
        })}
        {coaches.length === 0 ? <p className="text-muted sm:col-span-2">No coaches match that search.</p> : null}
      </section>
    </PageShell>
  );
}
