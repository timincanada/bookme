import { Check, X } from "lucide-react";
import type { PlanFeatureCard } from "@/lib/bookme/plan-features";
import { cn } from "@/lib/utils";

export function PlanFeatureList({ card, className }: { card: PlanFeatureCard; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {card.groups.map((group, index) => {
        const excluded = group.lines.every((line) => line.tone === "excluded");
        return (
          <div key={group.title ?? `group-${index}`}>
            {group.title ? (
              <p
                className={cn(
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
              className={cn("space-y-2", group.title && "mt-2")}
              aria-label={group.title ? (excluded ? `${group.title}, not included` : group.title) : undefined}
            >
              {group.lines.map((line) => (
                <li
                  key={line.text}
                  className={cn("flex items-start gap-2 text-sm", line.tone === "excluded" && "text-muted")}
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
          </div>
        );
      })}
      {card.upgrade ? <p className="text-sm text-muted">{card.upgrade}</p> : null}
    </div>
  );
}
