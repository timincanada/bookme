import { formatMoney } from "../utils";
import { priceForDuration } from "./duration-prices";
import { durationsFromService } from "./setup";

/** List label. Blank service names read as Lesson. */
export function lessonDisplayName(name: string | null | undefined) {
  const trimmed = String(name ?? "").trim();
  return trimmed || "Lesson";
}

/** One duration row: `30 min · $80`. */
export function lessonDurationPriceLine(minutes: number, priceCad: number) {
  return `${minutes} min · ${formatMoney(priceCad).replace(".00", "")}`;
}

export function lessonCatalogLines(service: {
  name?: string | null;
  duration?: number | null;
  durations?: number[] | null;
  priceCad: number;
  durationPrices?: Record<string, number> | null;
  duration_prices?: unknown;
}) {
  return {
    name: lessonDisplayName(service.name),
    lines: durationsFromService(service).map((minutes) =>
      lessonDurationPriceLine(minutes, priceForDuration(service, minutes)),
    ),
  };
}
