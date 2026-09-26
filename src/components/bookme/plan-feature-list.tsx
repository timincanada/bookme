import { Check, X } from "lucide-react";
import type { PlanFeatureCard } from "@/lib/bookme/plan-features";
import { cn } from "@/lib/utils";

export function PlanFeatureList({ card, className }: { card: PlanFeatureCard; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {card.groups.map((group, index) => {
        const excluded = group.lines.every((line) => line.tone === "excluded");
        return (
          <div key={group.title ?? `group-${index}`}>
            {group.title ? (
              <p
                className={cn(
                  "leading-snug",
                  group.kicker
                    ? "text-xs font-semibold uppercase tracking-wide text-muted"
                    : "text-sm font-semibold",
                  !group.kicker && (excluded ? "text-muted" : "text-forest"),
                )}
              >
                {group.title}
              </p>
            ) : null}
            <ul
              className={cn("space-y-1", group.title && "mt-1.5")}
              aria-label={group.title ? (excluded ? `${group.title}, not included` : group.title) : undefined}
            >
              {group.lines.map((line) => (
                <li
                  key={line.text}
                  className={cn(
                    "flex items-start gap-2 text-sm leading-snug",
                    line.tone === "excluded" && "text-muted",
                  )}
                >
                  {line.tone === "excluded" ? (
                    <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                  ) : (
                    <Check className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
                  )}
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
            {group.note ? <p className="mt-1.5 text-xs leading-snug text-muted">{group.note}</p> : null}
          </div>
        );
      })}
      {card.upgrade ? <p className="text-sm font-semibold leading-snug text-forest">{card.upgrade}</p> : null}
    </div>
  );
}
