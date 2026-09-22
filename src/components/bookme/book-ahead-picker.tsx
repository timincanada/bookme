import { BOOK_AHEAD_OPTIONS } from "@/lib/bookme/book-ahead";
import { cn } from "@/lib/utils";

export function BookAheadPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BOOK_AHEAD_OPTIONS.map((o) => (
        <button
          key={o.days}
          type="button"
          onClick={() => onChange(o.days)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium ring-1",
            value === o.days ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
