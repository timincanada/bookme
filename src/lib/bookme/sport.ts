import type { Sport } from "@/lib/coaches";
import { isOtherVerticalId, sportFromTitle, verticalById } from "./verticals";

export function asSport(value: string): Sport {
  if (isOtherVerticalId(value)) return value;
  const known = verticalById(value);
  if (known) return known.id;
  return sportFromTitle(value);
}
