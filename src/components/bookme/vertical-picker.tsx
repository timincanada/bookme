import { useMemo, useState } from "react";
import { SportIcon } from "@/components/sport-icon";
import {
  VERTICAL_GROUPS,
  groupForVertical,
  verticalById,
  verticalByLabel,
  type VerticalGroupId,
  type VerticalId,
} from "@/lib/bookme/verticals";
import { cn } from "@/lib/utils";

export function VerticalPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: VerticalId, label: string) => void;
}) {
  const selected =
    verticalById(value)?.id ?? verticalByLabel(value)?.id ?? (value as VerticalId);
  const initialGroup = groupForVertical(selected)?.id ?? "sport";
  const [groupId, setGroupId] = useState<VerticalGroupId>(initialGroup);
  const group = useMemo(
    () => VERTICAL_GROUPS.find((g) => g.id === groupId) ?? VERTICAL_GROUPS[0],
    [groupId],
  );

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {VERTICAL_GROUPS.map((g) => {
          const on = g.id === groupId;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroupId(g.id)}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full border px-3.5 py-2 text-sm font-medium leading-none",
                on
                  ? "border-forest bg-forest text-on-forest"
                  : "border-line bg-card hover:bg-paper-2",
              )}
            >
              {g.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {group.items.map((item) => {
          const on = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id, item.label)}
              className={cn(
                "flex min-h-[4.5rem] items-start gap-3 rounded-2xl px-3 py-3 text-left ring-1 transition-colors",
                on ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper-2",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                  on ? "bg-on-forest/15 text-on-forest" : "bg-sage-3 text-forest",
                )}
              >
                <SportIcon sport={item.id} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                <span className={cn("mt-0.5 block text-[11px] leading-snug", on ? "text-on-forest/80" : "text-muted")}>
                  {item.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
