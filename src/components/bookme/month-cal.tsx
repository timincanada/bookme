import { useState } from "react";
import { monthGrid, pad, shiftMonth } from "@/lib/bookme/time";
import { cn } from "@/lib/utils";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function MonthCal({
  value,
  onChange,
  max,
  today,
}: {
  value: string;
  onChange: (day: string) => void;
  max?: string;
  /** The coach's civil date (todayKey(coach timezone)). */
  today: string;
}) {
  const initial = value || today;
  const [year, setYear] = useState(() => Number(initial.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initial.slice(5, 7)));
  const cells = monthGrid(year, month);
  const label = new Date(year, month - 1, 1).toLocaleString("en-CA", { month: "long", year: "numeric" });
  const next = shiftMonth(year, month, 1);
  const nextStart = `${next.year}-${pad(next.month)}-01`;
  const canNext = !max || nextStart <= max;

  function move(delta: number) {
    if (delta > 0 && !canNext) return;
    const n = shiftMonth(year, month, delta);
    setYear(n.year);
    setMonth(n.month);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="rounded-lg px-2 py-1 text-sm font-semibold text-forest">
          Prev
        </button>
        <div className="font-semibold">{label}</div>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!canNext}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-forest disabled:text-line"
        >
          Next
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {DOW.map((d, i) => (
          <div key={`${d}-${i}`} className="py-1 font-medium">
            {d}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} />;
          const past = key < today;
          const beyond = Boolean(max && key > max);
          const closed = past || beyond;
          const on = key === value;
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              disabled={closed}
              onClick={() => onChange(key)}
              className={cn(
                "aspect-square rounded-xl text-sm",
                closed && "text-line",
                !closed && on && "bg-forest font-semibold text-on-forest",
                !closed && !on && isToday && "text-forest ring-1 ring-forest",
                !closed && !on && !isToday && "text-ink",
              )}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
