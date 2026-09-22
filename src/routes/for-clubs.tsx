import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarRange, Users, Wallet } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-clubs")({ component: ForClubs });

const ITEMS = [
  {
    icon: Users,
    title: "A roster, not a spreadsheet",
    body: "Give every coach a public page under the club brand. Clients book the person they want.",
  },
  {
    icon: CalendarRange,
    title: "Courts without collisions",
    body: "Shared hours and locations so two private lessons never land on the same court.",
  },
  {
    icon: Wallet,
    title: "Payouts per coach",
    body: "Club takes the booking. Coach sees their share. HST stays honest.",
  },
  {
    icon: Building2,
    title: "Looks like your club",
    body: "Cream, forest, your wordmark. No marketplace chrome. A page parents will trust.",
  },
];

function ForClubs() {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          For modern clubs
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
          One club. Many coaches. One calendar.
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          BookMe is how independent programs inside a club take bookings without a front-desk
          bottleneck — or a dozen DMs in a parent group chat.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link to="/start">Talk to us — start free</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:px-8 md:grid-cols-2">
        {ITEMS.map((f) => (
          <article key={f.title} className="rounded-2xl bg-card p-8 ring-1 ring-line">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-sage-3 text-forest">
              <f.icon className="size-4" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 font-sans text-xl font-semibold">{f.title}</h2>
            <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
