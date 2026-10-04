import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openingGroupView, slotSelectionPhrase, type OpeningGroup } from "@/lib/bookme/opening-slots";
import { cn } from "@/lib/utils";

/**
 * Selectable openings. Location is shown once per date group.
 * Continue sends the chosen time through the existing assistant composer.
 */
export function AssistantTimeSlots({
  groups,
  onContinue,
}: {
  groups: OpeningGroup[];
  onContinue?: (phrase: string) => void;
}) {
  const [selected, setSelected] = useState<{ key: string; phrase: string } | null>(null);
  const visible = groups
    .map((group) => ({ group, view: openingGroupView(group) }))
    .filter((row) => row.view.times.length > 0);

  if (!visible.length) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-4 ring-1 ring-line">
        <p className="text-sm font-semibold text-ink">Open times</p>
        <p className="mt-2 text-sm text-muted">No openings in that window.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">Open times</p>
      <div className="mt-3 space-y-4">
        {visible.map(({ group, view }) => (
          <div key={group.dateKey || group.label}>
            <p className="text-sm font-semibold text-forest">{group.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {view.times.map((time) => {
                const key = `${group.dateKey || group.label}|${time}`;
                const on = selected?.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected({ key, phrase: slotSelectionPhrase(group.label, time) })}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-[var(--radius-pill)] px-3.5 text-sm font-semibold transition-colors duration-150",
                      on ? "bg-forest text-on-forest" : "bg-paper text-ink ring-1 ring-line",
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
            {view.location ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 break-words">{view.location}</span>
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {selected && onContinue ? (
        <Button className="mt-4 w-full" size="field" type="button" onClick={() => onContinue(selected.phrase)}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}
