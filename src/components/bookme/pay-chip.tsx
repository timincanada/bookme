import { cn } from "@/lib/utils";

export function PayChip({ kind, text }: { kind: string; text: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        kind === "paid" && "bg-forest text-on-forest",
        kind === "offline" && "bg-sage-3 text-forest",
        kind !== "paid" && kind !== "offline" && "border border-line text-muted",
      )}
    >
      {text}
    </span>
  );
}

export function StatusChip({ children }: { children: string }) {
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">{children}</span>;
}
