import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function MessageRow({
  clientId,
  name,
  preview,
  time,
  unread,
}: {
  clientId: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
}) {
  return (
    <li>
      <Link
        to="/app/messages/$clientId"
        params={{ clientId }}
        className="flex min-h-[76px] items-center gap-3 px-3 py-2 hover:bg-paper"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-2 text-sm font-semibold text-forest">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={cn("min-w-0 truncate text-base", unread ? "font-semibold text-ink" : "font-medium text-ink")}>
              {name}
            </span>
            <span className="shrink-0 text-xs text-muted">{time}</span>
          </span>
          <span className={cn("mt-0.5 block truncate text-sm", unread ? "text-ink-soft" : "text-muted")}>{preview}</span>
        </span>
        {unread ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-forest">
            <span className="size-2 rounded-full bg-forest" aria-hidden />
            Unread
          </span>
        ) : null}
      </Link>
    </li>
  );
}
