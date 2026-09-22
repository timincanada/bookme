import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: Pricing });

const PLANS = [
  {
    name: "Light",
    price: "CA$19",
    note: "per month · up to 20 confirmed lessons",
    cta: "Start 3-day trial",
    to: "/start",
    featured: false,
    items: [
      "Public booking page",
      "Weekly hours and real slots",
      "Pay in person",
      "Client records",
    ],
  },
  {
    name: "Coach",
    price: "CA$29",
    note: "per month · 21–60 confirmed lessons",
    cta: "Start 3-day trial",
    to: "/start",
    featured: true,
    items: [
      "Everything in Light",
      "Assistant (openings, email, hours)",
      "Multiple locations",
      "Reschedule and next-week booking",
    ],
  },
  {
    name: "Busy",
    price: "CA$49",
    note: "per month · 61+ confirmed lessons",
    cta: "Start 3-day trial",
    to: "/start",
    featured: false,
    items: [
      "Everything in Coach",
      "For full calendars",
      "Same assistant tools",
      "Plan follows last month’s volume",
    ],
  },
];

function Pricing() {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          Pricing
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
          Start free. Grow when you’re ready.
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          Keep 100% of lesson fees. BookMe is a subscription — not a cut of your coaching.
        </p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-20 sm:px-8 lg:grid-cols-3">
        {PLANS.map((p) => (
          <article
            key={p.name}
            className={cn(
              "flex flex-col rounded-2xl bg-card p-7 ring-1 ring-line",
              p.featured && "ring-2 ring-forest shadow-card",
            )}
          >
            <p className="text-sm font-semibold text-forest">{p.name}</p>
            <p className="mt-3 font-display text-4xl font-medium">{p.price}</p>
            <p className="mt-1 text-sm text-muted">{p.note}</p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {p.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-forest" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8" variant={p.featured ? "primary" : "outline"} size="field">
              <Link to={p.to}>{p.cta}</Link>
            </Button>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
