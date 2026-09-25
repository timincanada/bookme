import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { nextHighlightIndex, searchTimezones, timezoneFriendlyName, timezoneUtcHint } from "@/lib/bookme/timezone";

type Props = {
  value: string;
  onChange: (tz: string) => void;
  labelledBy?: string;
};

export function TimezoneSelect({ value, onChange, labelledBy }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pickedAt = useRef(0);
  const listId = useId();

  const results = useMemo(() => searchTimezones(open ? query : "", 10), [open, query]);
  const active = results.length === 0 ? -1 : Math.min(Math.max(hi, 0), results.length - 1);

  function close() {
    setOpen(false);
    setQuery("");
    setHi(0);
  }

  function openList() {
    setQuery("");
    setHi(0);
    setOpen(true);
  }

  function pick(tz: string) {
    const now = Date.now();
    if (now - pickedAt.current < 400) return;
    pickedAt.current = now;
    onChange(tz);
    searchRef.current?.blur();
    close();
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    function outside(e: Event) {
      const target = e.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("touchstart", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId, query]);

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => nextHighlightIndex(i, results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => nextHighlightIndex(i, results.length, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const tz = active >= 0 ? results[active] : undefined;
      if (tz) pick(tz);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && wrapRef.current?.contains(next)) return;
        if (open) close();
      }}
    >
      {!open ? (
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={false}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-labelledby={labelledBy}
          className="field mt-1 flex h-auto min-h-12 items-center justify-between py-2 text-left"
          onClick={() => openList()}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              openList();
            }
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
          ref={searchRef}
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-labelledby={labelledBy}
          value={query}
          placeholder="Search timezones"
          onChange={(e) => {
            setQuery(e.target.value);
            setHi(0);
          }}
          onKeyDown={onSearchKey}
          className="field mt-1 ring-2 ring-forest/30"
        />
      )}
      {open ? (
        <ul id={listId} role="listbox" aria-labelledby={labelledBy} className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-card shadow-soft">
          {results.map((tz, index) => {
            const selected = tz === value;
            const highlighted = index === active;
            const hint = timezoneUtcHint(tz);
            return (
              <li key={tz} role="presentation">
                <button
                  id={`${listId}-opt-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center justify-between gap-2 border-b border-line px-3 py-2.5 text-left last:border-0 ${
                    highlighted || selected ? "bg-sage-3" : "hover:bg-sage-3/60"
                  }`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pick(tz);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(tz);
                  }}
                  onClick={() => pick(tz)}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{timezoneFriendlyName(tz)}</span>
                    <span className="block truncate text-sm text-muted">
                      {tz}
                      {hint ? ` · ${hint}` : ""}
                    </span>
                  </span>
                  {selected ? <span className="text-forest">✓</span> : null}
                </button>
              </li>
            );
          })}
          {results.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No matching timezones</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
