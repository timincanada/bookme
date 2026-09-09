"use client";

import {
  MAX_SEGMENTS_PER_DAY,
  clock,
  dayError,
  parseClock,
  type HourSegment,
} from "@/lib/hours";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  hours: HourSegment[];
  onChange: (hours: HourSegment[]) => void;
};

export function WeeklyHoursEditor({ hours, onChange }: Props) {
  function toggleDay(weekday: number) {
    const exists = hours.some((h) => h.weekday === weekday);
    if (exists) {
      onChange(hours.filter((h) => h.weekday !== weekday));
      return;
    }
    onChange(
      [...hours, { weekday, startMin: 10 * 60, endMin: 20 * 60 }].sort(
        (a, b) => a.weekday - b.weekday || a.startMin - b.startMin,
      ),
    );
  }

  function updateSegment(weekday: number, index: number, field: "startMin" | "endMin", value: number) {
    const daySegs = hours.filter((h) => h.weekday === weekday);
    const others = hours.filter((h) => h.weekday !== weekday);
    const nextDay = daySegs.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange([...others, ...nextDay].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin));
  }

  function addSegment(weekday: number) {
    const daySegs = hours.filter((h) => h.weekday === weekday);
    if (daySegs.length >= MAX_SEGMENTS_PER_DAY) return;
    const last = daySegs[daySegs.length - 1];
    const startMin = last ? Math.min(last.endMin + 60, 22 * 60) : 10 * 60;
    const endMin = Math.min(startMin + 120, 24 * 60);
    onChange(
      [...hours, { weekday, startMin, endMin }].sort(
        (a, b) => a.weekday - b.weekday || a.startMin - b.startMin,
      ),
    );
  }

  function removeSegment(weekday: number, index: number) {
    const daySegs = hours.filter((h) => h.weekday === weekday);
    if (daySegs.length <= 1) {
      onChange(hours.filter((h) => h.weekday !== weekday));
      return;
    }
    const others = hours.filter((h) => h.weekday !== weekday);
    const nextDay = daySegs.filter((_, i) => i !== index);
    onChange([...others, ...nextDay].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin));
  }

  return (
    <div className="mt-3 space-y-2">
      {DAYS.map((label, weekday) => {
        const daySegs = hours.filter((h) => h.weekday === weekday);
        const checked = daySegs.length > 0;
        const err = checked ? dayError(hours, weekday) : null;
        return (
          <div key={label} className="rounded-2xl border border-line bg-surface p-3">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={checked} onChange={() => toggleDay(weekday)} />
              {label}
            </label>
            {checked && (
              <div className="mt-2 space-y-2">
                {daySegs.map((seg, index) => (
                  <div key={`${weekday}-${index}`} className="flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <input
                        type="time"
                        value={clock(seg.startMin)}
                        onChange={(e) => updateSegment(weekday, index, "startMin", parseClock(e.target.value))}
                        className="field min-w-0 py-1"
                      />
                      <span className="hidden text-center text-muted sm:inline">–</span>
                      <input
                        type="time"
                        value={clock(seg.endMin)}
                        onChange={(e) => updateSegment(weekday, index, "endMin", parseClock(e.target.value))}
                        className="field min-w-0 py-1"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Remove hours"
                      onClick={() => removeSegment(weekday, index)}
                      className="mt-1 shrink-0 px-1 text-sm text-muted"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {err && <p className="text-sm text-danger">{err}</p>}
                {daySegs.length < MAX_SEGMENTS_PER_DAY ? (
                  <button
                    type="button"
                    onClick={() => addSegment(weekday)}
                    className="text-sm font-semibold text-brand"
                  >
                    + Add hours
                  </button>
                ) : (
                  <p className="text-sm text-muted">Max 3 blocks</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
