import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WeatherChipView } from "@/components/bookme/weather-chip";
import { coachThreadCards, studentThreadCards } from "@/lib/bookme/messages-api";
import type { ThreadCardModel } from "@/lib/bookme/thread-cards";
import { coachThreadWeather, studentThreadWeather } from "@/lib/bookme/weather-api";
import type { WeatherSnippet } from "@/lib/bookme/weather-service";

const EMPTY: ThreadCardModel = { pending: null, booking: null };

type Props = { audience: "coach"; clientId: string } | { audience: "student"; coachId: string };

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
              <WeatherChipView summary={weather.summary} icon={weather.icon} extreme={weather.extreme} size="sm" />
              {weather.extreme && weather.signal ? (
                <p className="mt-1 text-xs text-ink-soft">Forecast may affect an outdoor lesson · {weather.signal}</p>
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
