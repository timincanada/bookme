import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { WeatherChip } from "@/components/bookme/weather-chip";
import type { HourSegment } from "@/lib/bookme/hours";
import type { LessonWeatherView } from "@/lib/bookme/weather-service";
import { firstName } from "@/lib/bookme/requests";
import {
  addDaysKey,
  dateKeyAt,
  formatDateKey,
  formatHourLabel,
  formatTime,
  formatWeekRange,
  minutesAt,
  monthGrid,
  shiftMonth,
  todayKey,
  weekKeys,
} from "@/lib/bookme/time";
import { cn } from "@/lib/utils";

export type CalLesson = {
  id: string;
  start: string;
  when: string;
  time: string;
  status: string;
  statusLabel: string;
  bucket: string;
  clientName: string;
  locationName: string;
  serviceName: string;
  duration: number;
  pendingKind?: string | null;
  pay?: { text: string; kind: string };
  recurring?: boolean;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PX_PER_HOUR = 56;

/** Civil date of the lesson in the coach's time zone. */
export function lessonDateKey(lesson: CalLesson, tz: string) {
  return dateKeyAt(new Date(lesson.start), tz);
}

export function nextLessonDay(lessons: CalLesson[], tz: string, today = todayKey(tz)) {
  if (lessons.some((lesson) => lessonDateKey(lesson, tz) === today)) return today;
  const upcoming = [...lessons]
    .sort((a, b) => a.start.localeCompare(b.start))
    .find((lesson) => lessonDateKey(lesson, tz) >= today);
  if (upcoming) return lessonDateKey(upcoming, tz);
  const last = [...lessons].sort((a, b) => b.start.localeCompare(a.start))[0];
  return last ? lessonDateKey(last, tz) : today;
}

function toneFor(lesson: CalLesson) {
  if (lesson.bucket === "cancelled" || lesson.status === "cancelled" || lesson.status === "expired") {
    return "bg-paper-2 text-muted ring-1 ring-line line-through";
  }
  if (lesson.bucket === "completed") {
    return "bg-paper-2 text-ink-soft ring-1 ring-line";
  }
  if (lesson.status === "held") {
    return "bg-sage-2 text-forest";
  }
  return "bg-forest text-on-forest";
}

function gridRange(hours: HourSegment[], lessons: CalLesson[], tz: string) {
  let lo = 8 * 60;
  let hi = 20 * 60;
  if (hours.length) {
    lo = Math.min(...hours.map((h) => h.startMin));
    hi = Math.max(...hours.map((h) => h.endMin));
  }
  for (const lesson of lessons) {
    const start = minutesAt(new Date(lesson.start), tz);
    lo = Math.min(lo, start);
    hi = Math.max(hi, start + lesson.duration);
  }
  const startHour = Math.max(0, Math.floor(lo / 60));
  const endHour = Math.min(24, Math.max(startHour + 8, Math.ceil(hi / 60)));
  return { startHour, endHour };
}

function Nav({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous"
        className="inline-flex size-11 items-center justify-center rounded-full text-forest hover:bg-sage-3"
      >
        <ChevronLeft className="size-5" />
      </button>
      <p className="min-w-0 flex-1 text-center font-display text-xl font-medium sm:text-2xl">{label}</p>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next"
        className="inline-flex size-11 items-center justify-center rounded-full text-forest hover:bg-sage-3"
      >
        <ChevronRight className="size-5" />
      </button>
      <button
        type="button"
        onClick={onToday}
        className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-forest hover:bg-sage-3"
      >
        Today
      </button>
    </div>
  );
}

function LessonBlock({
  lesson,
  className,
  style,
}: {
  lesson: CalLesson;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      to="/app/lessons/$id"
      params={{ id: lesson.id }}
      className={cn("overflow-hidden rounded-lg px-1.5 py-1 text-left leading-tight", toneFor(lesson), className)}
      style={style}
    >
      <p className="flex items-center gap-1 truncate text-xs font-semibold">
        {lesson.recurring ? <Repeat className="size-3 shrink-0 opacity-80" strokeWidth={2} aria-label="Recurring" /> : null}
        <span className="truncate">{firstName(lesson.clientName)}</span>
      </p>
      <p className="truncate text-[11px] opacity-80">{lesson.time}</p>
      {lesson.pendingKind ? <span className="mt-0.5 block size-1.5 rounded-full bg-current opacity-80" /> : null}
    </Link>
  );
}

export function WeekCalendar({
  lessons,
  hours,
  selected,
  onSelect,
  timezone,
  weatherByLesson,
  onWeatherResolved,
}: {
  lessons: CalLesson[];
  hours: HourSegment[];
  selected: string;
  onSelect: (day: string) => void;
  timezone: string;
  weatherByLesson?: Record<string, LessonWeatherView>;
  onWeatherResolved?: (decision: "keep" | "cancel" | "ask") => void;
}) {
  const tz = timezone;
  const today = useMemo(() => todayKey(tz), [tz]);
  const keys = useMemo(() => weekKeys(selected), [selected]);
  const { startHour, endHour } = useMemo(() => gridRange(hours, lessons, tz), [hours, lessons, tz]);
  const hoursCount = Math.max(1, endHour - startHour);
  const nowMin = minutesAt(new Date(), tz);
  const byDay = useMemo(() => {
    const map = new Map<string, CalLesson[]>();
    for (const key of keys) map.set(key, []);
    for (const lesson of lessons) {
      const key = lessonDateKey(lesson, tz);
      const list = map.get(key);
      if (list) list.push(lesson);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start));
    }
    return map;
  }, [keys, lessons, tz]);

  return (
    <div>
      <Nav
        label={formatWeekRange(keys)}
        onPrev={() => onSelect(addDaysKey(selected, -7))}
        onNext={() => onSelect(addDaysKey(selected, 7))}
        onToday={() => onSelect(today)}
      />
      <div className="mt-4 grid grid-cols-7 gap-1 md:hidden">
        {keys.map((key, i) => {
          const n = byDay.get(key)?.length || 0;
          const isToday = key === today;
          const on = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                "flex min-h-11 flex-col items-center rounded-2xl py-2 text-xs font-medium",
                on && "bg-forest text-on-forest",
                !on && isToday && "bg-sage-3 text-forest",
                !on && !isToday && "text-ink-soft hover:bg-paper-2",
              )}
            >
              <span className="uppercase tracking-wide opacity-70">{DOW[i]?.slice(0, 1)}</span>
              <span className="font-display text-lg font-medium leading-none">{Number(key.slice(8))}</span>
              <span className={cn("mt-1 size-1 rounded-full", n ? (on ? "bg-on-forest" : "bg-forest") : "bg-transparent")} />
            </button>
          );
        })}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-line md:block">
        <div className="grid min-w-[52rem]" style={{ gridTemplateColumns: "4.75rem repeat(7, minmax(0, 1fr))" }}>
          <div className="border-b border-line" />
          {keys.map((key, i) => {
            const isToday = key === today;
            return (
              <div
                key={`h-${key}`}
                className={cn("border-b border-l border-line px-2 py-2 text-center text-xs font-medium", isToday && "bg-sage-3/60")}
              >
                <span className="text-muted">{DOW[i]}</span>{" "}
                <span className="font-display text-base text-ink">{Number(key.slice(8))}</span>
              </div>
            );
          })}
          <div className="relative" style={{ height: hoursCount * PX_PER_HOUR }}>
            {Array.from({ length: hoursCount }, (_, i) => (
              <div
                key={startHour + i}
                className="absolute inset-x-0 -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums leading-none text-muted"
                style={{ top: i * PX_PER_HOUR }}
              >
                {formatHourLabel(startHour + i)}
              </div>
            ))}
          </div>
          {keys.map((key) => {
            const isToday = key === today;
            const dayLessons = byDay.get(key) || [];
            return (
              <div
                key={`g-${key}`}
                className={cn("relative border-l border-line", isToday && "bg-sage-3/40")}
                style={{ height: hoursCount * PX_PER_HOUR }}
              >
                {Array.from({ length: hoursCount }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-line/80" style={{ top: i * PX_PER_HOUR }} />
                ))}
                {isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-coral"
                    style={{ top: ((nowMin - startHour * 60) / 60) * PX_PER_HOUR }}
                  >
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-coral" />
                  </div>
                ) : null}
                {dayLessons.map((lesson) => {
                  const start = minutesAt(new Date(lesson.start), tz);
                  const top = ((start - startHour * 60) / 60) * PX_PER_HOUR;
                  const height = Math.max(28, (lesson.duration / 60) * PX_PER_HOUR - 4);
                  return (
                    <LessonBlock
                      key={lesson.id}
                      lesson={lesson}
                      className="absolute inset-x-1 z-[1]"
                      style={{ top, height }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <DayAgenda
        dateKey={selected}
        lessons={byDay.get(selected) || []}
        timezone={tz}
        weatherByLesson={weatherByLesson}
        onWeatherResolved={onWeatherResolved}
      />
    </div>
  );
}

export function DayAgenda({
  dateKey,
  lessons,
  timezone,
  weatherByLesson,
  onWeatherResolved,
}: {
  dateKey: string;
  lessons: CalLesson[];
  timezone: string;
  weatherByLesson?: Record<string, LessonWeatherView>;
  onWeatherResolved?: (decision: "keep" | "cancel" | "ask") => void;
}) {
  const today = todayKey(timezone);
  const label = formatDateKey(dateKey, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mt-5 md:hidden">
      <p className="text-sm font-semibold text-ink-soft">{dateKey === today ? "Today" : label}</p>
      {lessons.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No lessons this day.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {lessons.map((lesson) => (
            <li key={lesson.id} className="rounded-2xl bg-card p-3 ring-1 ring-line">
              <Link to="/app/lessons/$id" params={{ id: lesson.id }} className="flex gap-3">
                <div className="w-16 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{lesson.time}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{lesson.clientName}</p>
                  <p className="text-sm text-muted">
                    {lesson.duration} min · {lesson.locationName}
                    {lesson.recurring ? " · Recurring" : ""}
                  </p>
                  <p className="mt-1 text-xs font-medium text-forest">
                    {lesson.statusLabel}
                    {lesson.pendingKind ? (lesson.pendingKind === "coach_swap" ? " · Swap waiting" : " · Move waiting") : ""}
                  </p>
                </div>
                <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", lesson.bucket === "upcoming" && lesson.status !== "held" ? "bg-forest" : "bg-sage-2")} />
              </Link>
              {weatherByLesson?.[lesson.id] ? (
                <div className="mt-2 pl-[4.75rem]">
                  <WeatherChip view={weatherByLesson[lesson.id]} audience="coach" onResolved={onWeatherResolved} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function MonthCalendar({
  lessons,
  selected,
  onSelect,
  timezone,
  weatherByLesson,
  onWeatherResolved,
}: {
  lessons: CalLesson[];
  selected: string;
  onSelect: (day: string) => void;
  timezone: string;
  weatherByLesson?: Record<string, LessonWeatherView>;
  onWeatherResolved?: (decision: "keep" | "cancel" | "ask") => void;
}) {
  const tz = timezone;
  const today = useMemo(() => todayKey(tz), [tz]);
  const year = Number(selected.slice(0, 4));
  const month = Number(selected.slice(5, 7));
  const cells = monthGrid(year, month);
  const trailing = (7 - (cells.length % 7)) % 7;
  const grid = [...cells, ...Array.from({ length: trailing }, () => null)];
  const label = new Date(year, month - 1, 1).toLocaleString("en-CA", { month: "long", year: "numeric" });
  const byDay = useMemo(() => {
    const map = new Map<string, CalLesson[]>();
    for (const lesson of lessons) {
      const key = lessonDateKey(lesson, tz);
      const list = map.get(key) || [];
      list.push(lesson);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [lessons, tz]);

  function move(delta: number) {
    const next = shiftMonth(year, month, delta);
    const day = Math.min(Number(selected.slice(8)), new Date(next.year, next.month, 0).getDate());
    onSelect(`${next.year}-${String(next.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  const selectedLessons = (byDay.get(selected) || []).slice().sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div>
      <Nav label={label} onPrev={() => move(-1)} onNext={() => move(1)} onToday={() => onSelect(today)} />
      <div className="mt-4 overflow-hidden rounded-2xl bg-card ring-1 ring-line">
        <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">
          {DOW.map((d) => (
            <div key={d} className="py-2">
              <span className="sm:hidden">{d.slice(0, 1)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((key, i) => {
            if (!key) return <div key={`pad-${i}`} className="min-h-14 border-b border-r border-line/70 bg-paper-2/40 sm:min-h-24" />;
            const dayLessons = byDay.get(key) || [];
            const isToday = key === today;
            const on = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={cn(
                  "min-h-14 border-b border-r border-line/70 p-1.5 text-left align-top sm:min-h-24",
                  on && "bg-sage-3",
                  !on && isToday && "bg-cream",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                    on && "bg-forest text-on-forest",
                    !on && isToday && "text-forest ring-1 ring-forest",
                    !on && !isToday && "text-ink",
                  )}
                >
                  {Number(key.slice(8))}
                </span>
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {dayLessons.slice(0, 3).map((lesson) => (
                    <span
                      key={lesson.id}
                      className={cn("block truncate rounded px-1 py-0.5 text-[11px] font-medium", toneFor(lesson))}
                    >
                      {formatTime(new Date(lesson.start), tz).replace(":00", "")} {firstName(lesson.clientName)}
                    </span>
                  ))}
                  {dayLessons.length > 3 ? (
                    <span className="px-1 text-[11px] font-medium text-muted">+{dayLessons.length - 3}</span>
                  ) : null}
                </div>
                {dayLessons.length ? (
                  <span className="mt-1 flex justify-center gap-0.5 sm:hidden">
                    {dayLessons.slice(0, 3).map((lesson) => (
                      <span
                        key={lesson.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          lesson.bucket === "upcoming" && lesson.status !== "held" ? "bg-forest" : "bg-sage-2",
                        )}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold text-ink-soft">
          {selected === today ? "Today" : formatDateKey(selected, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {selectedLessons.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No lessons this day.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedLessons.map((lesson) => (
              <li key={lesson.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
                <Link to="/app/lessons/$id" params={{ id: lesson.id }} className="block">
                  <p className="font-semibold">
                    {lesson.time} · {lesson.clientName}
                  </p>
                  <p className="text-sm text-muted">
                    {lesson.locationName} · {lesson.statusLabel} · {lesson.pay?.text}
                    {lesson.recurring ? " · Recurring" : ""}
                  </p>
                  {lesson.pendingKind ? (
                    <p className="mt-2 text-xs font-semibold text-forest">
                      {lesson.pendingKind === "coach_swap" ? "Swap waiting on students" : "Move request waiting"}
                    </p>
                  ) : null}
                </Link>
                {weatherByLesson?.[lesson.id] ? (
                  <div className="mt-2">
                    <WeatherChip view={weatherByLesson[lesson.id]} audience="coach" onResolved={onWeatherResolved} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
