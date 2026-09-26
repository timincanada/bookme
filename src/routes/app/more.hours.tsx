import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookAheadPicker } from "@/components/bookme/book-ahead-picker";
import { WeeklyHoursEditor } from "@/components/bookme/weekly-hours-editor";
import { Button } from "@/components/ui/button";
import { saveCoachHours } from "@/lib/bookme/api";
import { DEFAULT_BOOK_AHEAD_DAYS, lastBookableDateKey, normalizeBookAheadDays } from "@/lib/bookme/book-ahead";
import type { HourSegment } from "@/lib/bookme/hours";
import { formatDateKey, todayKey } from "@/lib/bookme/time";
import { DEFAULT_TIMEZONE } from "@/lib/bookme/timezone";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/more/hours")({ component: HoursPage });

function HoursPage() {
  const { coach, reload } = useCoach();
  const [hours, setHours] = useState<HourSegment[]>(coach?.hours?.length ? coach.hours : defaultHours());
  const [bookAheadDays, setBookAheadDays] = useState(() =>
    normalizeBookAheadDays(coach?.bookAheadDays ?? DEFAULT_BOOK_AHEAD_DAYS),
  );
  const [msg, setMsg] = useState("");
  const tz = coach?.timezone || DEFAULT_TIMEZONE;
  const last = useMemo(() => lastBookableDateKey(bookAheadDays, todayKey(tz)), [bookAheadDays, tz]);
  const lastLabel = useMemo(() => formatDateKey(last), [last]);

  if (!coach) return null;

  async function save() {
    const res = await saveCoachHours({ data: { hours, bookAheadDays } });
    setMsg(res.ok ? "Saved." : res.error);
    if (res.ok) reload();
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="type-action text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="mt-3 font-display text-3xl font-medium">Hours & booking window</h1>
      <p className="mt-2 text-muted">Repeating weekly hours, and how far ahead students can pick a time.</p>
      <h2 className="type-section mt-6 font-display text-2xl font-medium">Booking window</h2>
      <p className="mt-1 text-muted">
        How far ahead students can book. You can still place or move a lesson further out yourself.
      </p>
      <div className="mt-4">
        <BookAheadPicker value={bookAheadDays} onChange={setBookAheadDays} />
      </div>
      <p className="mt-3 text-sm text-ink-soft">Students can book through {lastLabel}.</p>
      <Button className="mt-4" size="field" onClick={() => void save()}>
        Save
      </Button>
      {msg ? <p className="mt-3 text-sm text-ink-soft">{msg}</p> : null}
      <h2 className="type-section mt-8 font-display text-2xl font-medium">Weekly hours</h2>
      <p className="mt-1 text-muted">Students only see open slots inside these hours.</p>
      <div className="mt-5">
        <WeeklyHoursEditor hours={hours} onChange={setHours} />
      </div>
      <Button className="mt-6" size="field" onClick={() => void save()}>
        Save
      </Button>
    </div>
  );
}

function defaultHours(): HourSegment[] {
  return [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 10 * 60, endMin: 20 * 60 }));
}
