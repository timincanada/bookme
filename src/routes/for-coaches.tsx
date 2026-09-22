import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CalendarDays, CreditCard, Link2, MessageSquare, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-coaches")({ component: ForCoaches });

const FEATURES = [
  {
    icon: Link2,
    title: "A page that looks like you",
    body: "One link for your lesson, hours, and locations. Share it in a story, a text, or on the club board.",
  },
  {
    icon: CalendarDays,
    title: "Hours you actually want",
    body: "Set working hours, breaks, and time off. Clients only ever see slots you can teach.",
  },
  {
    icon: CreditCard,
    title: "Paid before they arrive",
    body: "Collect at checkout. HST done. No chasing e-transfers after a lesson.",
  },
  {
    icon: Users,
    title: "A quiet CRM",
    body: "Names, history, notes. Every session starts with context — not a blank chat thread.",
  },
  {
    icon: Bell,
    title: "Reminders that land",
    body: "Confirmations go out the moment they book. No-shows drop because nobody has to remember.",
  },
  {
    icon: MessageSquare,
    title: "Messages in one place",
    body: "Reschedules and questions sit next to the booking, not across three apps.",
  },
];

function ForCoaches() {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          For independent coaches
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
          More time coaching. Less time scheduling.
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          One link. They pick a slot. You show up to teach. Built for tennis, soccer, golf,
          fitness, swimming, music, and anyone else who coaches in person.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/start">Create your booking page</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/$slug" params={{ slug: "daniel-kim" }}>See a live page</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:px-8 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="rounded-2xl bg-card p-6 ring-1 ring-line">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-sage-3 text-forest">
              <f.icon className="size-4" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 font-sans text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
