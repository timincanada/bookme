import type { ReactNode } from "react";

/** Shared page heading for the coach tabs. Serif, no fixed height so type can scale. */
export function PageTitle({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[length:var(--text-display)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-base leading-snug text-muted">{subtitle}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
