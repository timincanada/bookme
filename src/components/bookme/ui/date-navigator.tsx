import { cn } from "@/lib/utils";

export type DateNavDay = { key: string; dow: string; date: string; count?: number };

/**
 * Week strip. The selected day is a filled circle up to 58px, shrinking so
 * seven days still fit at 320px. Today is an outline, not a second fill.
 */
export function DateNavigator({
  days,
  selected,
  today,
  onSelect,
}: {
  days: DateNavDay[];
  selected: string;
  today: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-7 gap-0.5 md:hidden">
      {days.map((day) => {
        const on = day.key === selected;
        const isToday = day.key === today;
        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect(day.key)}
            aria-pressed={on}
            aria-label={day.key}
            className="flex min-h-11 min-w-0 flex-col items-center gap-1 py-1"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{day.dow}</span>
            <span
              className={cn(
                "grid aspect-square w-[clamp(2.25rem,12vw,3.625rem)] max-w-full place-items-center rounded-[var(--radius-pill)] font-display text-lg font-medium leading-none",
                on && "bg-forest text-on-forest",
                !on && isToday && "text-forest ring-1 ring-forest",
                !on && !isToday && "text-ink",
              )}
            >
              {day.date}
            </span>
            <span className={cn("size-1 rounded-full", day.count ? "bg-forest" : "bg-transparent", on && day.count && "bg-forest")} />
          </button>
        );
      })}
    </div>
  );
}
