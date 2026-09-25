import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CreditCard,
  Heart,
  Link2,
  Shield,
  Trophy,
  Users,
  Dumbbell,
  Flower2,
  Clock,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DashboardPreview } from "@/components/dashboard-preview";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <Hero />
      <TrustBar />
      <Steps />
      <LifeBand />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute -left-20 top-24 h-[480px] w-[480px] text-sage/50" viewBox="0 0 400 400" fill="none">
          <path d="M40 320C120 220 80 80 200 40" stroke="currentColor" strokeWidth="1.2" />
          <path d="M20 260C140 200 160 60 300 80" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-8 sm:px-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-10 lg:pb-0 lg:pt-4">
        <div className="relative z-10 py-2 lg:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            More players. A brighter tomorrow.
          </p>
          <h1 className="mt-4 font-display text-[2.35rem] font-medium leading-[1.08] text-ink sm:text-5xl lg:text-[3.15rem]">
            Coaching is personal.
            <br />
            Booking should be effortless.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Your page. Your schedule. Your clients — all in one place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link to="/start">
                Create your booking page
                <span aria-hidden>→</span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/preview">See a sample page</Link>
            </Button>
          </div>
          <Link
            to="/preview"
            className="mt-5 flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-line hover:bg-paper-2"
          >
            <img
              src="/photos/jordan-k.jpg"
              alt=""
              className="size-12 rounded-xl object-cover"
            />
            <span className="min-w-0 text-left">
              <span className="block text-sm font-semibold text-ink">See a sample booking page</span>
              <span className="block text-xs text-muted">What your students see when they open your link</span>
            </span>
          </Link>
          <p className="mt-4 text-sm text-muted">No credit card required</p>
        </div>
        <Link
          to="/preview"
          className="relative block h-56 overflow-hidden rounded-3xl sm:h-72 lg:h-[620px] lg:rounded-t-3xl"
        >
          <img
            src="/photos/hero-tennis.jpg"
            alt="A tennis coach guiding a player’s grip on an outdoor court"
            className="absolute inset-0 h-full w-full object-cover object-[68%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/30 via-transparent to-transparent lg:bg-gradient-to-r lg:from-paper/70 lg:via-transparent lg:to-transparent" />
          <div className="absolute left-3 top-8 hidden w-[min(100%-1.5rem,390px)] lg:block">
            <DashboardPreview />
          </div>
          <p className="font-script absolute bottom-5 right-5 text-2xl text-on-forest drop-shadow sm:bottom-8 sm:right-8 sm:text-3xl">
            Coaches Change Lives
          </p>
        </Link>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { icon: Users, label: "Independent Coaches" },
    { icon: Shield, label: "Sports Clubs" },
    { icon: Trophy, label: "Tennis" },
    { icon: CircleBall, label: "Basketball" },
    { icon: Dumbbell, label: "Fitness" },
    { icon: Flower2, label: "And More" },
  ];
  return (
    <div className="border-y border-line bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center">
        <p className="shrink-0 text-sm text-muted">Trusted by independent coaches worldwide</p>
        <div className="hidden h-4 w-px bg-line lg:block" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-ink-soft">
          {items.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-2">
              <item.icon className="size-4 text-forest" strokeWidth={1.75} />
              {item.label}
            </span>
          ))}
        </div>
        <p className="ml-auto hidden text-sm text-muted lg:block">
          Built for independent coaches and modern clubs
        </p>
      </div>
    </div>
  );
}

function CircleBall({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.5 3 2.5 15 0 18M3 12c3-2.5 15-2.5 18 0" />
    </svg>
  );
}

function Steps() {
  const steps = [
    {
      icon: Link2,
      title: "1. Share your page",
      body: "Create a beautiful booking page in minutes and share it anywhere.",
    },
    {
      icon: CalendarDays,
      title: "2. Clients choose a time",
      body: "They view your availability, book a session, and get an instant confirmation.",
    },
    {
      icon: CreditCard,
      title: "3. Get paid and coach",
      body: "Payments are handled securely so you can focus on what you do best.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        Simple. Powerful. Yours.
      </p>
      <h2 className="mt-3 text-center font-display text-3xl font-medium sm:text-4xl">
        Get started in three easy steps
      </h2>
      <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-0">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className={i < 2 ? "md:border-r md:border-line md:px-8 first:md:pl-0 last:md:pr-0" : "md:px-8"}
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-sage-3 text-forest">
              <step.icon className="size-5" strokeWidth={1.75} />
            </span>
            <h3 className="mt-5 font-sans text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LifeBand() {
  const points = [
    {
      icon: Users,
      title: "Grow your business",
      body: "Attract more clients and fill your calendar.",
    },
    {
      icon: Clock,
      title: "Save time",
      body: "Automate bookings and reminders.",
    },
    {
      icon: Heart,
      title: "Focus on what matters",
      body: "Less admin. More coaching. A bigger impact.",
    },
  ];
  return (
    <section className="overflow-hidden bg-sage-3/70">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
        <div className="relative min-h-[320px]">
          <img
            src="/photos/jordan-k.jpg"
            alt="Tennis coach smiling on court"
            className="absolute inset-0 h-full w-full object-cover object-[30%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/70 via-forest/20 to-transparent" />
          <blockquote className="relative z-10 flex h-full max-w-md flex-col justify-end p-8 text-on-forest sm:p-12">
            <p className="font-display text-2xl font-medium leading-snug sm:text-[1.85rem]">
              “BookMe gave me back hours of admin time. Now I can focus on my players.”
            </p>
            <footer className="mt-5 text-sm">
              <div className="font-semibold">Jordan K.</div>
              <div className="text-on-forest/80">Tennis Coach</div>
            </footer>
          </blockquote>
        </div>
        <div className="relative px-8 py-12 sm:px-12 lg:py-16">
          <svg className="pointer-events-none absolute -right-10 top-6 h-64 w-64 text-sage" viewBox="0 0 200 200" fill="none">
            <path d="M20 160C80 80 140 40 190 20" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            More than a booking tool.
          </p>
          <h2 className="mt-3 max-w-sm font-display text-3xl font-medium sm:text-4xl">
            Same Passion.
            <br />
            More Players.
          </h2>
          <p className="font-script absolute right-8 top-10 text-2xl leading-tight text-forest sm:right-12 sm:top-12 sm:text-3xl">
            Same Passion
            <br />
            <span className="relative inline-block">
              More Players
              <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-coral" />
            </span>
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {points.map((p) => (
              <div key={p.title}>
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-card text-forest ring-1 ring-line">
                  <p.icon className="size-4" strokeWidth={1.75} />
                </span>
                <h3 className="mt-3 font-sans text-sm font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild>
              <Link to="/for-coaches">See why coaches switch</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
