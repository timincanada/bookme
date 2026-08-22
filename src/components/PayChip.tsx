export function PayChip({ kind, text }: { kind: string; text: string }) {
  if (kind === "paid") {
    return <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">Paid</span>;
  }
  if (kind === "offline") {
    return <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dark">Collected offline</span>;
  }
  if (kind === "unpaid") {
    return <span className="rounded-full border border-warn px-2.5 py-0.5 text-xs font-medium text-warn">Unpaid</span>;
  }
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">{text}</span>;
}

export function StatusChip({ children }: { children: string }) {
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium capitalize text-muted">{children}</span>;
}
