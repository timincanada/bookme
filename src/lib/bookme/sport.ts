import type { Sport } from "@/lib/coaches";
import { sportFromTitle, verticalById } from "./verticals";

export function asSport(value: string): Sport {
  const known = verticalById(value);
  if (known) return known.id;
  return sportFromTitle(value);
}
