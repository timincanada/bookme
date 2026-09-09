"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchTimezones, timezoneFriendlyName, timezoneUtcHint } from "@/lib/timezone";

type Props = {
  value: string;
  onChange: (tz: string) => void;
};

export function TimezoneSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => searchTimezones(open ? query : "", 10), [open, query]);

  return (
    <div ref={wrapRef} className="relative">
      {!open ? (
        <button
          type="button"
          className="field mt-1 flex items-center justify-between text-left"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
        >
          <span className="min-w-0 truncate">
            <span className="block font-medium">{timezoneFriendlyName(value)}</span>
            <span className="block text-xs text-muted">{value}</span>
          </span>
          <span className="ml-2 text-muted" aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <input
          autoFocus
          value={query}
          placeholder="Search timezones"
          onChange={(e) => setQuery(e.target.value)}
          className="field mt-1 border-brand"
        />
      )}
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface shadow-lg">
          {results.map((tz) => {
            const selected = tz === value;
            const hint = timezoneUtcHint(tz);
            return (
              <li key={tz}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2.5 text-left last:border-0 ${
                    selected ? "bg-brand-soft" : "hover:bg-brand-soft/60"
                  }`}
                  onClick={() => {
                    onChange(tz);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{timezoneFriendlyName(tz)}</span>
                    <span className="block truncate text-sm text-muted">
                      {tz}
                      {hint ? ` · ${hint}` : ""}
                    </span>
                  </span>
                  {selected ? <span className="text-brand">✓</span> : null}
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matching timezones</li>
          )}
        </ul>
      )}
    </div>
  );
}
