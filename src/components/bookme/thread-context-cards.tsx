import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { WeatherChipView } from "@/components/bookme/weather-chip";
import { coachThreadCards, studentThreadCards } from "@/lib/bookme/messages-api";
import type {
  ThreadBookingCard,
  ThreadCardModel,
  ThreadPendingCard,
} from "@/lib/bookme/thread-cards";
import { coachThreadWeather, studentThreadWeather } from "@/lib/bookme/weather-api";
import type { WeatherSnippet } from "@/lib/bookme/weather-service";
import { cn } from "@/lib/utils";

const EMPTY: ThreadCardModel = { pending: null, booking: null };

type Props = (
  { audience: "coach"; clientId: string } | { audience: "student"; coachId: string }
) & {
  /** Coach chat thread: one-line bars that expand to the full cards. */
  variant?: "compact";
};

/**
 * Swap (or move) and next booking, stacked under the thread header.
 * A failed load shows the empty line — never an error.
 */
export function ThreadContextCards(props: Props) {
  const audience = props.audience;
  const clientId = props.audience === "coach" ? props.clientId : "";
  const coachId = props.audience === "student" ? props.coachId : "";
  const [cards, setCards] = useState<ThreadCardModel | null>(null);
  const [weather, setWeather] = useState<WeatherSnippet | null>(null);
  const bookingId = cards?.booking?.id ?? "";

  useEffect(() => {
    let alive = true;
    const req =
      audience === "coach"
        ? coachThreadCards({ data: { clientId } })
        : studentThreadCards({ data: { coachId } });
    req.then((res) => {
      if (!alive) return;
      setCards(res.ok ? { pending: res.pending, booking: res.booking } : EMPTY);
    });
    return () => {
      alive = false;
    };
  }, [audience, clientId, coachId]);

  useEffect(() => {
    if (!bookingId) {
      setWeather(null);
      return;
    }
    let alive = true;
    const req =
      audience === "coach"
        ? coachThreadWeather({ data: { lessonId: bookingId } })
        : studentThreadWeather({ data: { lessonId: bookingId } });
    req.then((res) => {
      if (!alive) return;
      setWeather(res.ok ? res.weather : null);
    });
    return () => {
      alive = false;
    };
  }, [audience, bookingId]);

  if (!cards) return null;
  if (props.variant === "compact") {
    return (
      <CompactThreadContext
        audience={props.audience}
        pending={cards.pending}
        booking={cards.booking}
        weather={weather}
      />
    );
  }
  const { pending, booking } = cards;

  return (
    <div className="space-y-2 border-b border-line px-3 py-3" aria-label="Lesson context">
      {pending ? (
        <div className="rounded-xl border-l-[3px] border-l-amber-500 bg-amber-50 px-3 py-2.5">
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {pending.kind === "coach_swap" ? "Swap pending" : "Move pending"}
          </span>
          <p className="mt-1.5 text-sm leading-snug text-ink">{pending.lines[0]}</p>
          {pending.lines[1] ? (
            <p className="text-sm leading-snug text-ink">{pending.lines[1]}</p>
          ) : null}
          {props.audience === "coach" ? (
            <Link
              to="/app/bookings"
              search={{ tab: "requests", swap: undefined }}
              className="mt-1.5 inline-block text-sm font-semibold text-forest"
            >
              Review in Bookings
            </Link>
          ) : (
            <Link
              to="/manage"
              search={{ email: undefined, token: undefined }}
              className="mt-1.5 inline-block text-sm font-semibold text-forest"
            >
              Review in Bookings
            </Link>
          )}
        </div>
      ) : null}
      {booking ? (
        <div className="rounded-xl border border-line border-l-[3px] border-l-[#10B981] bg-card px-3 py-2.5">
          <span className="inline-flex rounded-full bg-sage-3 px-2 py-0.5 text-[11px] font-semibold text-forest">
            Next booking
          </span>
          <p className="mt-1.5 text-sm leading-snug text-ink">
            {booking.dateLabel} · {booking.timeLabel} · {booking.place}
          </p>
          {weather ? (
            <div className="mt-2">
              <WeatherChipView
                summary={weather.summary}
                icon={weather.icon}
                extreme={weather.extreme}
                size="sm"
              />
              {weather.extreme && weather.signal ? (
                <p className="mt-1 text-xs text-ink-soft">
                  Forecast may affect an outdoor lesson · {weather.signal}
                </p>
              ) : null}
            </div>
          ) : null}
          {props.audience === "coach" ? (
            <Link
              to="/app/lessons/$id"
              params={{ id: booking.id }}
              className="mt-1 inline-block text-sm text-muted"
            >
              Open lesson
            </Link>
          ) : weather?.extreme ? (
            <Link
              to="/manage"
              search={{ email: undefined, token: undefined }}
              className="mt-1 inline-block text-sm font-semibold text-forest"
            >
              Review lesson
            </Link>
          ) : null}
        </div>
      ) : null}
      {!pending && !booking ? (
        <p className="text-sm text-muted">No upcoming booking with this client.</p>
      ) : null}
    </div>
  );
}

function tempToken(summary: string | null | undefined) {
  if (!summary) return "";
  return summary.match(/-?\d+°/)?.[0] ?? "";
}

function nextLine(booking: ThreadBookingCard, weather: WeatherSnippet | null) {
  const bits = [booking.dateLabel, booking.timeLabel, booking.place];
  const temp = tempToken(weather?.summary);
  if (temp) bits.push(temp);
  return `Next: ${bits.join(" · ")}`;
}

function ReviewLink({
  audience,
  className,
  children,
}: {
  audience: "coach" | "student";
  className: string;
  children: string;
}) {
  if (audience === "coach") {
    return (
      <Link to="/app/bookings" search={{ tab: "requests", swap: undefined }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/manage" search={{ email: undefined, token: undefined }} className={className}>
      {children}
    </Link>
  );
}

function CompactThreadContext({
  audience,
  pending,
  booking,
  weather,
}: {
  audience: "coach" | "student";
  pending: ThreadPendingCard | null;
  booking: ThreadBookingCard | null;
  weather: WeatherSnippet | null;
}) {
  const [pendingOpen, setPendingOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const line = booking ? nextLine(booking, weather) : "";

  return (
    <div className="border-b border-line bg-paper" aria-label="Lesson context">
      {pending ? (
        <div className="border-l-[3px] border-l-amber-500">
          <div className="flex h-10 items-center gap-2 px-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              aria-expanded={pendingOpen}
              onClick={() => setPendingOpen((open) => !open)}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted transition-transform",
                  pendingOpen && "rotate-180",
                )}
                aria-hidden
              />
              <span className="shrink-0 text-[11px] font-semibold text-amber-700">
                {pending.kind === "coach_swap" ? "Swap pending" : "Move pending"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink" title={pending.lines[0]}>
                {pending.lines[0]}
              </span>
            </button>
            <ReviewLink audience={audience} className="shrink-0 text-xs font-semibold text-forest">
              Review
            </ReviewLink>
          </div>
          {pendingOpen ? (
            <div className="bg-amber-50 px-3 py-2.5">
              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {pending.kind === "coach_swap" ? "Swap pending" : "Move pending"}
              </span>
              <p className="mt-1.5 text-sm leading-snug text-ink">{pending.lines[0]}</p>
              {pending.lines[1] ? (
                <p className="text-sm leading-snug text-ink">{pending.lines[1]}</p>
              ) : null}
              <ReviewLink
                audience={audience}
                className="mt-1.5 inline-block text-sm font-semibold text-forest"
              >
                Review in Bookings
              </ReviewLink>
            </div>
          ) : null}
        </div>
      ) : null}
      {booking ? (
        <div
          className={cn("border-l-[3px] border-l-[#10B981]", pending && "border-t border-t-line")}
        >
          <div className="flex h-10 items-center gap-2 px-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              aria-expanded={bookingOpen}
              onClick={() => setBookingOpen((open) => !open)}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted transition-transform",
                  bookingOpen && "rotate-180",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink" title={line}>
                {line}
              </span>
            </button>
            {weather?.extreme ? (
              <span className="shrink-0 text-[11px] font-semibold text-amber-700">Alert</span>
            ) : null}
            {audience === "coach" ? (
              <Link
                to="/app/lessons/$id"
                params={{ id: booking.id }}
                className="shrink-0 text-xs font-semibold text-forest"
              >
                Open
              </Link>
            ) : weather?.extreme ? (
              <Link
                to="/manage"
                search={{ email: undefined, token: undefined }}
                className="shrink-0 text-xs font-semibold text-forest"
              >
                Review
              </Link>
            ) : null}
          </div>
          {bookingOpen ? (
            <div className="border-t border-line bg-card px-3 py-2.5">
              <span className="inline-flex rounded-full bg-sage-3 px-2 py-0.5 text-[11px] font-semibold text-forest">
                Next booking
              </span>
              <p className="mt-1.5 text-sm leading-snug text-ink">
                {booking.dateLabel} · {booking.timeLabel} · {booking.place}
              </p>
              {weather ? (
                <div className="mt-2">
                  <WeatherChipView
                    summary={weather.summary}
                    icon={weather.icon}
                    extreme={weather.extreme}
                    size="sm"
                  />
                  {weather.extreme && weather.signal ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      Forecast may affect an outdoor lesson · {weather.signal}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {audience === "coach" ? (
                <Link
                  to="/app/lessons/$id"
                  params={{ id: booking.id }}
                  className="mt-1 inline-block text-sm text-muted"
                >
                  Open lesson
                </Link>
              ) : weather?.extreme ? (
                <Link
                  to="/manage"
                  search={{ email: undefined, token: undefined }}
                  className="mt-1 inline-block text-sm font-semibold text-forest"
                >
                  Review lesson
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!pending && !booking ? (
        <p className="truncate px-3 py-2 text-sm text-muted">
          No upcoming booking with this client.
        </p>
      ) : null}
    </div>
  );
}
