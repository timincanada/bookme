import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[var(--radius-card)] bg-card ring-1 ring-line", className)}>{children}</div>
  );
}
