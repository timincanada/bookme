import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { createBooking, getPublicCoach, recordVisit } from "@/lib/bookme/api";
import { formatWhen } from "@/lib/bookme/time";
import { formatMoney } from "@/lib/utils";

type Search = { start?: string; location?: string; service?: string; duration?: number };

export const Route = createFileRoute("/book/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    start: typeof s.start === "string" ? s.start : undefined,
    location: typeof s.location === "string" ? s.location : undefined,
    service: typeof s.service === "string" ? s.service : undefined,
    duration: typeof s.duration === "number" ? s.duration : typeof s.duration === "string" && s.duration.trim() !== "" ? Number(s.duration) : undefined,
  }),
  component: BookPage,
});

function BookPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [coach, setCoach] = useState<Awaited<ReturnType<typeof getPublicCoach>>>(null);

  useEffect(() => {
    getPublicCoach({ data: { slug } }).then(setCoach);
    const visitorId = localStorage.getItem("bookme.vid") || "";
    recordVisit({ data: { visitorId } }).then((r) => {
      localStorage.setItem("bookme.vid", r.visitorId);
    });
  }, [slug]);

  if (!search.start) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <Logo />
        <p className="text-muted">Choose a lesson and time first.</p>
        <Button asChild>
          <Link to="/$slug" params={{ slug }}>
            Back to coach
          </Link>
        </Button>
      </main>
    );
  }

  const lesson = coach?.services.find((s) => s.id === search.service) ?? coach?.services[0];
  const location = coach?.locations.find((l) => l.id === search.location) ?? coach?.locations[0];
  const methods: Array<"cash" | "card"> = coach?.payMethods?.length ? coach.payMethods : ["cash"];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!search.start) return;
    setBusy(true);
    const result = await createBooking({
      data: {
        slug,
        start: search.start,
        name,
        email,
        locationId: search.location,
        serviceId: search.service,
        duration: search.duration ?? lesson?.duration,
        method: methods.includes(method) ? method : methods[0],
      },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if ("checkoutUrl" in result && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    void navigate({ to: "/confirmed", search: { id: result.id } });
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-2xl items-center px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <form onSubmit={submit} className="mx-auto max-w-xl px-5 pb-16 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Review</p>
        <h1 className="mt-3 font-display text-4xl font-medium">Review & confirm</h1>
        <p className="mt-2 text-ink-soft">
          {coach?.name ?? "Coach"} · {lesson?.name ?? "Private"} · {search.duration ?? lesson?.duration ?? 60} min
        </p>
        <div className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
          <p className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-forest" />
            {coach ? formatWhen(new Date(search.start), coach.timezone) : ""}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <MapPin className="size-4 text-forest" />
            {location?.name ?? "Location"}
          </p>
          {lesson ? (
            <p className="mt-4 border-t border-line pt-4 text-sm font-semibold">
              {formatMoney(lesson.priceCad)} · {method === "card" ? "pay by card · 15-minute hold" : "pay in person"}
            </p>
          ) : null}
        </div>
        {methods.length > 1 ? (
          <div className="mt-6">
            <p className="mb-1.5 text-sm font-medium">Payment</p>
            <div className="flex gap-2">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-full px-4 py-2 text-sm ring-1 ${method === m ? "bg-forest text-on-forest ring-forest" : "ring-line"}`}
                >
                  {m === "card" ? "Card" : "Cash"}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-medium">Your name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input className="field" type="email" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <p className="mt-3 text-sm text-muted">
          {method === "card"
            ? "Card holds the time for 15 minutes. Free reschedule until 24 hours before the lesson. No student account needed."
            : "Free reschedule until 24 hours before the lesson. No student account needed."}
        </p>
        <Button type="submit" size="field" className="mt-6" disabled={busy || name.trim().length < 2}>
          {busy ? "Booking…" : "Confirm booking"}
        </Button>
      </form>
    </main>
  );
}
