import { durationsFromService } from "./setup";

/** Integer CAD. Coaches cannot publish a lesson above this. */
export const MAX_PRICE_CAD = 10000;

export type DurationPriceMap = Record<string, number>;

export type PricedService = {
  priceCad?: number | null;
  price_cad?: number | null;
  duration?: number | null;
  durations?: number[] | null;
  durationPrices?: DurationPriceMap | null;
  duration_prices?: unknown;
};

/** Parse a jsonb/object/string map of minutes → CAD. Drops junk keys. */
export function parseDurationPrices(raw: unknown): DurationPriceMap | null {
  if (raw == null || raw === "") return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: DurationPriceMap = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const minutes = Number(key);
    const price = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    if (!Number.isFinite(price)) continue;
    const n = Math.round(price);
    if (!Number.isInteger(n) || n <= 0 || n > MAX_PRICE_CAD) continue;
    out[String(Math.round(minutes))] = n;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Price for one lesson length. A missing map or key uses price_cad / priceCad.
 */
export function priceForDuration(service: PricedService, minutes: number): number {
  const map = parseDurationPrices(service.durationPrices ?? service.duration_prices);
  const key = String(minutes);
  if (map && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  const fallback = Number(service.priceCad ?? service.price_cad ?? 0);
  return Number.isFinite(fallback) ? Math.round(fallback) : 0;
}

/**
 * One integer price per enabled duration.
 * A missing entry uses `fallback`. An explicit 0 or junk value is kept so
 * validation can reject it instead of silently substituting.
 */
export function normalizeDurationPrices(
  durations: readonly number[],
  prices: Record<string | number, number | string | null | undefined> | null | undefined,
  fallback: number,
): DurationPriceMap {
  const fb = Math.round(Number(fallback));
  const safe = Number.isInteger(fb) && fb > 0 && fb <= MAX_PRICE_CAD ? fb : 0;
  const out: DurationPriceMap = {};
  for (const minutes of durations) {
    const raw = prices?.[minutes] ?? prices?.[String(minutes)];
    if (raw == null || raw === "") {
      out[String(minutes)] = safe;
      continue;
    }
    const n = Math.round(Number(raw));
    out[String(minutes)] = Number.isFinite(Number(raw)) ? n : safe;
  }
  return out;
}

export function validateDurationPrices(
  durations: readonly number[],
  prices: DurationPriceMap,
): { ok: true; prices: DurationPriceMap; priceCad: number } | { ok: false; error: string } {
  if (!durations.length) return { ok: false, error: "Enter a price" };
  const ordered = [...durations].sort((a, b) => a - b);
  const out: DurationPriceMap = {};
  for (const minutes of ordered) {
    const n = Math.round(Number(prices[String(minutes)]));
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "Enter a price" };
    if (n > MAX_PRICE_CAD) return { ok: false, error: `Price must be ${MAX_PRICE_CAD} CAD or less` };
    out[String(minutes)] = n;
  }
  return { ok: true, prices: out, priceCad: out[String(ordered[0])] };
}

/** Lowest bookable price across services and their lengths. */
export function listedFromPrice(services: readonly PricedService[]): number {
  let min = Infinity;
  for (const service of services) {
    for (const minutes of durationsFromService(service)) {
      const price = priceForDuration(service, minutes);
      if (price > 0 && price < min) min = price;
    }
  }
  return min === Infinity ? 0 : min;
}

/** True when one service charges different amounts for different lengths. */
export function servicePricesDiffer(service: PricedService): boolean {
  const durations = durationsFromService(service);
  if (durations.length < 2) return false;
  const first = priceForDuration(service, durations[0]);
  return durations.some((minutes) => priceForDuration(service, minutes) !== first);
}
