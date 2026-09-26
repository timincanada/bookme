import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { PlanFeatureList } from "@/components/bookme/plan-feature-list";
import { Button } from "@/components/ui/button";
import { planFeatureCard } from "@/lib/bookme/plan-features";
import { PLANS, planLessonRange, type PlanId } from "@/lib/bookme/subscription";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: Pricing });

const ORDER: PlanId[] = ["light", "coach", "busy"];

function priceNote(plan: PlanId) {
  const range = planLessonRange(plan).replace(" / month", "");
  return `per month · ${range.charAt(0).toLowerCase()}${range.slice(1)}`;
}

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
      <section className="mx-auto grid max-w-6xl gap-6 px-5 sm:px-8 lg:grid-cols-3">
        {ORDER.map((id) => {
          const plan = PLANS[id];
          const featured = id === "coach";
          return (
            <article
              key={id}
              className={cn(
                "flex h-full min-w-0 flex-col rounded-2xl bg-card p-7 ring-1 ring-line",
                featured && "ring-2 ring-forest shadow-card",
              )}
            >
              <p className="text-sm font-semibold text-forest">{plan.name}</p>
              <p className="mt-3 font-display text-4xl font-medium">CA${plan.cad}</p>
              <p className="mt-1 text-sm text-muted">{priceNote(id)}</p>
              <PlanFeatureList card={planFeatureCard(id)} className="mt-6 flex-1" />
              <Button asChild className="mt-8" variant={featured ? "primary" : "outline"} size="field">
                <Link to="/start">Start 3-day trial</Link>
              </Button>
            </article>
          );
        })}
      </section>
      <p className="mx-auto max-w-3xl px-5 pb-20 pt-8 text-center text-sm text-muted sm:px-8">
        Your tier follows last month's confirmed lessons.
      </p>
    </PageShell>
  );
}
