"use client";
import { useMemo, useState } from "react";
import { monthGrid, shiftMonth, torontoDateKey } from "@/lib/time";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function MonthCal({
  value,
  onChange,
}: {
  value: string;
  onChange: (day: string) => void;
}) {
  const today = useMemo(() => torontoDateKey(), []);
  const initial = value || today;
  const [year, setYear] = useState(() => Number(initial.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initial.slice(5, 7)));
  const cells = monthGrid(year, month);
  const label = new Date(year, month - 1, 1).toLocaleString("en-CA", { month: "long", year: "numeric" });

  function move(delta: number) {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="rounded-lg px-2 py-1 text-sm font-semibold text-brand">
          Prev
        </button>
        <div className="font-semibold">{label}</div>
        <button type="button" onClick={() => move(1)} className="rounded-lg px-2 py-1 text-sm font-semibold text-brand">
          Next
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {DOW.map((d, i) => (
          <div key={`${d}-${i}`} className="py-1 font-medium">{d}</div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} />;
          const past = key < today;
          const on = key === value;
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              disabled={past}
              onClick={() => onChange(key)}
              className={`aspect-square rounded-xl text-sm ${
                past
                  ? "text-line"
                  : on
                    ? "bg-brand font-semibold text-white"
                    : isToday
                      ? "border border-brand text-brand-dark"
                      : "text-ink"
              }`}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
