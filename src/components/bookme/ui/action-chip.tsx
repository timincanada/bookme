import type { LucideIcon } from "lucide-react";

export function ActionChip({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-[var(--radius-pill)] bg-card px-4 text-sm font-semibold text-forest ring-1 ring-line transition-transform duration-150 active:scale-[0.98]"
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}
