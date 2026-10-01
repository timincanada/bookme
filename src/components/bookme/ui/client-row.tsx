import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function ClientRow({ id, name, email }: { id: string; name: string; email: string }) {
  return (
    <li>
      <Link
        to="/app/clients/$id"
        params={{ id }}
        className="flex min-h-[72px] items-center gap-3 px-3 py-2 hover:bg-paper"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-2 text-sm font-semibold text-forest">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-ink">{name}</span>
          <span className="mt-0.5 block truncate text-sm text-muted">{email}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      </Link>
    </li>
  );
}
