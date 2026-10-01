import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mt-4 rounded-[var(--radius-card)] bg-card px-5 py-6 text-left ring-1 ring-line">
      <p className="font-display text-2xl font-medium leading-tight text-ink">{title}</p>
      {body ? <p className="mt-1.5 text-base leading-snug text-muted">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
