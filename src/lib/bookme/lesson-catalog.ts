import { formatMoney } from "../utils";
import { durationsFromService } from "./setup";

/** List label. Blank service names read as Lesson. */
export function lessonDisplayName(name: string | null | undefined) {
  const trimmed = String(name ?? "").trim();
  return trimmed || "Lesson";
}

/** One duration row: `30 min · $80`. The same service price is shown on every length. */
export function lessonDurationPriceLine(minutes: number, priceCad: number) {
  return `${minutes} min · ${formatMoney(priceCad).replace(".00", "")}`;
}

export function lessonCatalogLines(service: {
  name?: string | null;
  duration?: number | null;
  durations?: number[] | null;
  priceCad: number;
}) {
  return {
    name: lessonDisplayName(service.name),
    lines: durationsFromService(service).map((minutes) => lessonDurationPriceLine(minutes, service.priceCad)),
  };
}
