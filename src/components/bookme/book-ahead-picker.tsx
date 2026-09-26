import { useState } from "react";
import {
  BOOK_AHEAD_OPTIONS,
  MAX_BOOK_AHEAD_DAYS,
  MIN_BOOK_AHEAD_DAYS,
  normalizeBookAheadDays,
} from "@/lib/bookme/book-ahead";
import { cn } from "@/lib/utils";

/** Shortcuts plus any custom number of days (1–120). */
export function BookAheadPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const isPreset = BOOK_AHEAD_OPTIONS.some((o) => o.days === value);
  const [custom, setCustom] = useState(isPreset ? "" : String(value));
  const [showCustom, setShowCustom] = useState(!isPreset);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {BOOK_AHEAD_OPTIONS.map((o) => (
          <button
            key={o.days}
            type="button"
            onClick={() => {
              setShowCustom(false);
              setCustom("");
              onChange(o.days);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium ring-1",
              value === o.days && !showCustom ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper-2",
            )}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium ring-1",
            showCustom ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper-2",
          )}
        >
          Custom
        </button>
      </div>
      {showCustom ? (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input
            className="field h-11 w-24 shrink-0 max-w-full"
            type="number"
            inputMode="numeric"
            min={MIN_BOOK_AHEAD_DAYS}
            max={MAX_BOOK_AHEAD_DAYS}
            value={custom}
            placeholder={String(value)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              setCustom(raw);
              if (raw) onChange(normalizeBookAheadDays(raw));
            }}
            onBlur={() => {
              const n = normalizeBookAheadDays(custom || value);
              setCustom(String(n));
              onChange(n);
            }}
          />
          <span className="text-muted">
            days ahead ({MIN_BOOK_AHEAD_DAYS}–{MAX_BOOK_AHEAD_DAYS})
          </span>
        </label>
      ) : null}
    </div>
  );
}
