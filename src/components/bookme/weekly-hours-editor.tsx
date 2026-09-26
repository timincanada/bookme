import {
  MAX_SEGMENTS_PER_DAY,
  clock,
  dayError,
  parseClock,
  type HourSegment,
} from "@/lib/bookme/hours";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeeklyHoursEditor({
  hours,
  onChange,
}: {
  hours: HourSegment[];
  onChange: (hours: HourSegment[]) => void;
}) {
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
    <div className="space-y-2">
      {DAYS.map((label, weekday) => {
        const daySegs = hours.filter((h) => h.weekday === weekday);
        const checked = daySegs.length > 0;
        const err = checked ? dayError(hours, weekday) : null;
        return (
          <div key={label} className="rounded-2xl bg-card p-3 ring-1 ring-line">
            <label className="type-key flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={checked} onChange={() => toggleDay(weekday)} />
              {label}
            </label>
            {checked ? (
              <div className="mt-2 space-y-2">
                {daySegs.map((seg, index) => (
                  <div key={`${weekday}-${index}`} className="flex flex-col gap-2 md:flex-row md:items-center">
                    <input
                      type="time"
                      value={clock(seg.startMin)}
                      onChange={(e) => updateSegment(weekday, index, "startMin", parseClock(e.target.value))}
                      className="field min-w-0 max-w-full py-1 md:flex-1"
                    />
                    <div className="flex min-w-0 items-center gap-2 md:contents">
                      <span className="shrink-0 text-muted">–</span>
                      <input
                        type="time"
                        value={clock(seg.endMin)}
                        onChange={(e) => updateSegment(weekday, index, "endMin", parseClock(e.target.value))}
                        className="field min-w-0 max-w-full flex-1 py-1"
                      />
                      <button
                        type="button"
                        aria-label="Remove hours"
                        onClick={() => removeSegment(weekday, index)}
                        className="shrink-0 px-1 text-sm text-muted"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {daySegs.length < MAX_SEGMENTS_PER_DAY ? (
                  <button type="button" className="text-sm font-semibold text-forest" onClick={() => addSegment(weekday)}>
                    + Add hours
                  </button>
                ) : (
                  <p className="text-xs text-muted">Max 3 blocks</p>
                )}
                {err ? <p className="text-sm text-coral">{err}</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
