import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Check, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getBooking } from "@/lib/bookme/api";
import { formatMoney } from "@/lib/utils";

type Search = { id?: string };

export const Route = createFileRoute("/confirmed")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: Confirmed,
});

function Confirmed() {
  const { id } = Route.useSearch();
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof getBooking>> | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setBooking(null);
      return;
    }
    getBooking({ data: { id } }).then(setBooking);
  }, [id]);

  const held = booking?.status === "held";
  const heading = !id
    ? "You’re booked."
    : booking === undefined
      ? "Loading…"
      : booking === null
        ? "Booking not found."
        : held
          ? "Time held for 15 minutes."
          : "You’re booked.";
  const sub = !booking
    ? id && booking === undefined
      ? "Loading your lesson…"
      : id && booking === null
        ? "That confirmation link is not valid."
        : "Your lesson is confirmed."
    : held
      ? `Finish card payment to confirm. A hold is on ${booking.clientEmail}.`
      : `A confirmation was sent to ${booking.clientEmail}.`;

  return (
    <main className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-2xl items-center px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <div className="mx-auto max-w-xl px-5 py-10 sm:px-8">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-sage-3 text-forest">
          <Check className="size-7" strokeWidth={2.2} />
        </span>
        <h1 className="mt-5 font-display text-4xl font-medium">{heading}</h1>
        <p className="mt-3 text-ink-soft">{sub}</p>
        {booking ? (
          <div className="mt-8 rounded-2xl bg-card p-6 ring-1 ring-line">
            <p className="font-display text-2xl font-medium">{booking.serviceName}</p>
            <p className="mt-1 text-muted">with {booking.coachName}</p>
            <div className="mt-5 space-y-3 text-sm">
              <p className="type-primary flex items-center gap-2">
                <CalendarDays className="size-4 text-forest" />
                {booking.when}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-forest" />
                {booking.locationName}
              </p>
            </div>
            <div className="mt-5 flex justify-between border-t border-line pt-4 font-semibold">
              <span>{booking.payText}</span>
              <span className="tabular-nums">{formatMoney(booking.priceCad)}</span>
            </div>
          </div>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            {booking?.coachSlug ? (
              <Link to="/$slug" params={{ slug: booking.coachSlug }}>
                Book another lesson
              </Link>
            ) : (
              <Link to="/">Home</Link>
            )}
          </Button>
          <Button asChild variant="outline">
            <Link to="/manage" search={booking ? { email: booking.clientEmail } : {}}>
              Reschedule or cancel
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted">Free reschedule until 24 hours before the lesson.</p>
      </div>
    </main>
  );
}
