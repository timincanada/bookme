import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import {
  nextHighlightIndex,
  searchTimezones,
  timezoneFriendlyName,
  timezoneUtcHint,
} from "@/lib/bookme/timezone";

type Props = {
  value: string;
  onChange: (tz: string) => void;
  labelledBy?: string;
};

/** Blur/Tab close waits so a press that started in the list can cancel it before click. */
const BLUR_CLOSE_MS = 100;

export function TimezoneSelect({ value, onChange, labelledBy }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointerInsideRef = useRef(false);
  const pointerGen = useRef(0);
  const closeTimerRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const openRef = useRef(false);
  const listId = useId();

  const results = useMemo(() => searchTimezones(open ? query : "", 10), [open, query]);
  const active = results.length === 0 ? -1 : Math.min(Math.max(hi, 0), results.length - 1);

  function clearCloseTimer() {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function close() {
    clearCloseTimer();
    pointerGen.current += 1;
    pointerInsideRef.current = false;
    openRef.current = false;
    setOpen(false);
    setQuery("");
    setHi(0);
  }

  function openList() {
    clearCloseTimer();
    pointerGen.current += 1;
    pointerInsideRef.current = false;
    openRef.current = true;
    setQuery("");
    setHi(0);
    setOpen(true);
  }

  function armPointerInside() {
    pointerGen.current += 1;
    pointerInsideRef.current = true;
    clearCloseTimer();
  }

  function pick(tz: string) {
    onChange(tz);
    close();
    // After this click finishes. Focusing mid-click can synthesize a click on the trigger.
    if (focusFrameRef.current != null) cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = requestAnimationFrame(() => {
      focusFrameRef.current = null;
      triggerRef.current?.focus();
    });
  }

  function releasePointerInside() {
    const gen = pointerGen.current;
    window.setTimeout(() => {
      if (pointerGen.current === gen) pointerInsideRef.current = false;
    }, BLUR_CLOSE_MS);
  }

  const handlersRef = useRef({ armPointerInside, close, releasePointerInside });
  handlersRef.current = { armPointerInside, close, releasePointerInside };

  useEffect(() => {
    if (!open) return;
    function outside(e: Event) {
      const target = e.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) {
        handlersRef.current.armPointerInside();
        return;
      }
      handlersRef.current.close();
    }
    function release() {
      handlersRef.current.releasePointerInside();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      clearCloseTimer();
    };
  }, [open]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      if (focusFrameRef.current != null) {
        cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
    };
  }, []);

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

  function onWrapBlur(e: FocusEvent<HTMLDivElement>) {
    if (!openRef.current) return;
    const next = e.relatedTarget;
    if (next instanceof Node && wrapRef.current?.contains(next)) return;
    if (pointerInsideRef.current) return;
    clearCloseTimer();
    const gen = pointerGen.current;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (pointerGen.current !== gen || !openRef.current || pointerInsideRef.current) return;
      const activeEl = document.activeElement;
      if (activeEl instanceof Node && wrapRef.current?.contains(activeEl)) return;
      close();
    }, BLUR_CLOSE_MS);
  }

  function keepSearchFocused(e: { preventDefault(): void }) {
    // Keeps the search field focused so the list stays mounted until click.
    e.preventDefault();
    armPointerInside();
  }

  return (
    <div ref={wrapRef} className="relative" onBlur={onWrapBlur}>
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
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-card shadow-soft"
        >
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
                  onPointerDown={keepSearchFocused}
                  onMouseDown={keepSearchFocused}
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
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching timezones</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
