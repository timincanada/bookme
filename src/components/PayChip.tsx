export function PayChip({ kind, text }: { kind: string; text: string }) {
  if (kind === "paid") {
    return <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">{text}</span>;
  }
  if (kind === "offline") {
    return <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dark">{text}</span>;
  }
  if (kind === "unpaid") {
    return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">{text}</span>;
  }
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">{text}</span>;
}

export function StatusChip({ children }: { children: string }) {
  return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">{children}</span>;
}
