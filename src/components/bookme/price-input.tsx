import { useRef } from "react";
import { parsePriceInput, priceFieldError } from "@/lib/bookme/price-input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  labelledBy?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Coach price field. Text + numeric keypad, empty is allowed, and a stored 0
 * is shown as a grey placeholder rather than a character the coach must delete.
 */
export function PriceInput({ value, onChange, id, labelledBy, ...aria }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const swallowMouseUp = useRef(false);
  const display = value === "0" ? "" : parsePriceInput(value);

  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted" aria-hidden>
        $
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        className="field price-input"
        value={display}
        aria-labelledby={labelledBy}
        aria-label={aria["aria-label"]}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        onFocus={() => {
          const el = inputRef.current;
          if (!el) return;
          if (value === "0" || (value !== "" && parsePriceInput(value) === "")) onChange("");
          swallowMouseUp.current = true;
          requestAnimationFrame(() => el.select());
          window.setTimeout(() => el.select(), 0);
        }}
        onBlur={() => {
          swallowMouseUp.current = false;
        }}
        onMouseUp={(e) => {
          if (!swallowMouseUp.current) return;
          e.preventDefault();
          swallowMouseUp.current = false;
        }}
        onChange={(e) => onChange(parsePriceInput(e.target.value))}
      />
    </div>
  );
}

export function DurationPriceList({
  durations,
  prices,
  onChange,
}: {
  durations: number[];
  prices: Record<number, string>;
  onChange: (minutes: number, value: string) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium">Price (CAD)</p>
      {durations.map((minutes) => {
        const value = prices[minutes] ?? "";
        const err = priceFieldError(value);
        const labelId = `price-label-${minutes}`;
        const errId = `price-error-${minutes}`;
        return (
          <div key={minutes}>
            <div className="flex items-center gap-3">
              <span id={labelId} className="w-16 shrink-0 text-sm font-medium">
                {minutes} min
              </span>
              <PriceInput
                value={value}
                onChange={(next) => onChange(minutes, next)}
                labelledBy={labelId}
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? errId : undefined}
              />
            </div>
            {err ? (
              <p id={errId} className="mt-1 text-sm text-coral">
                {err}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
