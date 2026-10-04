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
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-card px-2 text-[11px] font-semibold tracking-tight text-forest ring-1 ring-line transition-transform duration-150 active:scale-[0.98] min-[360px]:gap-1 min-[360px]:px-2.5 min-[360px]:text-xs min-[360px]:tracking-normal min-[400px]:gap-1.5 min-[400px]:px-2.5 min-[400px]:text-[13px]"
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}
