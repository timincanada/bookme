import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Lock, MapPin } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { addDaysKey, formatDateKey, todayKey } from "@/lib/bookme/time";
import { DEFAULT_TIMEZONE } from "@/lib/bookme/timezone";

/**
 * Sample booking page for the marketing site: a fixed, non-interactive copy of
 * what a coach's page looks like. No database, no demo account, nothing bookable.
 */
export const Route = createFileRoute("/preview")({
  head: () => ({ meta: [{ title: "A sample booking page · BookMe" }] }),
  component: SamplePage,
});

const TIMES = ["8:00 a.m.", "9:00 a.m.", "10:00 a.m.", "4:00 p.m.", "5:00 p.m.", "6:00 p.m."];
const NOTES = [
  "Free cancellation up to 24 hours before your lesson.",
  "Bring your own racquet — loaners available on request.",
  "Lessons run rain or shine; indoor court in bad weather.",
];

function SamplePage() {
  const today = todayKey(DEFAULT_TIMEZONE);
  const days = [today, addDaysKey(today, 1)];

  return (
    <main className="min-h-screen bg-paper">
      <div className="bg-forest px-5 py-2.5 text-center text-sm text-on-forest sm:px-8">
        Sample page — nothing here is bookable.{" "}
        <Link to="/start" className="font-semibold underline underline-offset-2">
          Create your own
        </Link>
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Button asChild size="sm">
          <Link to="/start">Start free</Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Sample · Tennis coach</p>
          <h1 className="mt-3 font-display text-5xl font-medium leading-[1.05]">Riley Sample</h1>
          <p className="mt-3 text-lg text-ink-soft">Private tennis lessons · Markham, ON</p>
          <p className="mt-6 max-w-lg leading-relaxed text-ink-soft">
            Fifteen years coaching juniors and adults, from first serve to tournament play. Lessons are one-on-one and
            built around what you want to fix this month.
          </p>
          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            <Fact icon={<SportIcon sport="tennis" className="size-5" />} title="Private lesson" body="One-on-one coaching" />
            <Fact icon={<Clock className="size-5" />} title="60 minutes" body="Focused, personalized instruction" />
            <Fact icon={<MapPin className="size-5" />} title="Mayfair Parkway" body="Outdoor courts · Markham" />
          </dl>
        </div>

        <aside className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-line" aria-label="Sample booking panel">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-medium">Book a lesson</h2>
            <span className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Sample
            </span>
          </div>

          <h3 className="mt-5 text-sm font-semibold">Choose a lesson</h3>
          <div className="mt-2 flex w-full items-center justify-between rounded-xl bg-sage-3 px-4 py-3 text-left text-forest ring-1 ring-forest">
            <span>
              <span className="block text-sm font-semibold">Private lesson</span>
              <span className="text-xs opacity-80">60 min</span>
            </span>
            <span className="font-semibold">$85</span>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Choose a date</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {days.map((d, i) => (
              <div
                key={d}
                className={
                  i === 0
                    ? "rounded-xl bg-sage-3 px-3 py-3 text-left text-forest ring-1 ring-forest"
                    : "rounded-xl bg-card px-3 py-3 text-left ring-1 ring-line"
                }
              >
                <div className="font-semibold">{formatDateKey(d, { weekday: "short" })}</div>
                <div>{Number(d.slice(8))}</div>
              </div>
            ))}
          </div>

          <h3 className="mt-6 text-sm font-semibold">Available times</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMES.map((t, i) => (
              <span
                key={t}
                className={
                  i === 3
                    ? "grid h-11 min-w-[5.5rem] place-items-center rounded-xl bg-forest px-3 text-sm font-semibold text-on-forest ring-1 ring-forest"
                    : "grid h-11 min-w-[5.5rem] place-items-center rounded-xl bg-card px-3 text-sm font-semibold ring-1 ring-line"
                }
              >
                {t}
              </span>
            ))}
          </div>

          <Button className="mt-6 w-full" size="field" disabled>
            Continue to book
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" />
            Confirm now · Free reschedule until 24 hours
          </p>
          <p className="mt-4 text-center text-sm text-muted">On a real page, this is where students pick a time and pay.</p>
        </aside>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 border-t border-line px-5 py-12 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-medium">Before you book</h2>
          <ul className="mt-5 space-y-4">
            {NOTES.map((n) => (
              <li key={n} className="flex gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-3 text-forest">
                  {n.toLowerCase().includes("cancel") ? <CalendarDays className="size-4" /> : <SportIcon sport="tennis" />}
                </span>
                <p className="pt-2 text-sm text-ink-soft">{n}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-card p-6 ring-1 ring-line">
          <h2 className="font-display text-2xl font-medium">Your page, in a few minutes</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Set your lesson, price, locations and weekly hours. Share one link. Students book, pay and reschedule
            themselves — you keep the calendar, the client notes and the messages in one place.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="field">
              <Link to="/start">Create your booking page</Link>
            </Button>
            <Button asChild variant="outline" size="field">
              <Link to="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Fact({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-sage-3 text-forest">{icon}</span>
      <dt className="mt-3 text-sm font-semibold">{title}</dt>
      <dd className="text-sm text-muted">{body}</dd>
    </div>
  );
}
