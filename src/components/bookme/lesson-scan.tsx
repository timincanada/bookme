import type { ReactNode } from "react";
import { dateKeyAt, formatDateKey, formatTime } from "@/lib/bookme/time";
import { cn } from "@/lib/utils";

/** Time and short date from an instant, via the shared zone formatters. */
export function lessonInstantParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  return {
    time: formatTime(d, timeZone),
    date: formatDateKey(dateKeyAt(d, timeZone)),
  };
}

/**
 * Mobile lesson summary for a standalone card: label, time, name, date, location.
 * Day lists under a date header use `LessonRow` instead (no label, no date).
 * `md:hidden` drops it at ≥768px (display:none, so it is not read twice).
 * Keep the desktop copy on `max-md:hidden`.
 */
export function LessonScan({
  label,
  time,
  name,
  date,
  location,
  extra,
  className,
}: {
  label?: string;
  time: string;
  name?: string;
  date?: string;
  location?: string;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("md:hidden", className)}>
      {label ? <p className="type-label text-muted">{label}</p> : null}
      <p className="type-clock mt-1 break-words">{time}</p>
      {name ? <p className="type-key mt-1 break-words">{name}</p> : null}
      {date ? <p className="type-secondary mt-1 break-words text-muted">{date}</p> : null}
      {location ? <p className="type-secondary mt-0.5 break-words text-muted">{location}</p> : null}
      {extra}
    </div>
  );
}

/**
 * Day-list row under a date header (Schedule agenda, Bookings month list).
 * Time, client name, then a muted "60 min · place" line. No eyebrow and no
 * date — the header already shows the day. `md:hidden`.
 */
export function LessonRow({
  time,
  name,
  detail,
  extra,
  className,
}: {
  time: string;
  name?: string;
  detail?: string;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("md:hidden", className)}>
      <p className="type-clock break-words">{time}</p>
      {name ? <p className="type-row-name mt-0.5 break-words">{name}</p> : null}
      {detail ? <p className="type-secondary mt-0.5 break-words text-muted">{detail}</p> : null}
      {extra}
    </div>
  );
}
