import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({ component: HowItWorks });

const STEPS = [
  {
    n: "01",
    title: "Create your page",
    body: "Name, sport, city, lesson, and hours. A public page goes live in a few minutes — no designer required.",
  },
  {
    n: "02",
    title: "Share one link",
    body: "Instagram bio, WeChat, a text after a trial. Clients open your page on their phone and see only times you can teach.",
  },
  {
    n: "03",
    title: "They book and pay",
    body: "Details, card, HST, confirmation. You get a calendar that fills itself. They get a receipt and a 24-hour cancel window.",
  },
  {
    n: "04",
    title: "You show up to teach",
    body: "Reminders go out. The roster is in your workspace. Admin is done before you reach the court.",
  },
];

function HowItWorks() {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-5 pb-6 pt-14 text-center sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          How it works
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
          From link to lesson, without the back-and-forth.
        </h1>
      </section>
      <ol className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        {STEPS.map((s) => (
          <li key={s.n} className="grid grid-cols-[auto_1fr] gap-5 border-t border-line py-8">
            <span className="font-display text-2xl text-forest">{s.n}</span>
            <div>
              <h2 className="font-sans text-xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="pb-16 text-center">
        <Button asChild size="lg">
          <Link to="/$slug" params={{ slug: "daniel-kim" }}>Walk through a live booking</Link>
        </Button>
      </div>
    </PageShell>
  );
}
