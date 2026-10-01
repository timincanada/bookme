import { Search } from "lucide-react";
import { keepFieldVisible } from "@/components/bookme/ui/keep-field-visible";

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="relative mt-4 block min-w-0">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
        onFocus={(e) => keepFieldVisible(e.currentTarget)}
        className="field h-auto min-h-12 rounded-[var(--radius-pill)] pl-10"
      />
    </label>
  );
}
