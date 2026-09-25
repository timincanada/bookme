import { MAX_PRICE_CAD, priceForDuration, type PricedService } from "./duration-prices";

/** Digits only. Empty stays empty. Leading zeros are stripped, so "0" is empty. */
export function parsePriceInput(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "");
}

/** Integer CAD from a price field, or null when empty or out of range. */
export function priceInputToCad(raw: string): number | null {
  const digits = parsePriceInput(raw);
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isInteger(n) || n <= 0 || n > MAX_PRICE_CAD) return null;
  return n;
}

/** Inline save error. Empty is "Enter a price"; over the cap names the cap. */
export function priceFieldError(raw: string): string | null {
  const digits = parsePriceInput(raw);
  if (!digits) return "Enter a price";
  if (Number(digits) > MAX_PRICE_CAD) return `Price must be ${MAX_PRICE_CAD} CAD or less`;
  return null;
}

/**
 * Price to copy onto a duration that was just enabled.
 * Uses the first enabled length that already has a price.
 */
export function prefillDurationPrice(prices: Record<number, string>, enabled: readonly number[]): string {
  const ordered = [...enabled].sort((a, b) => a - b);
  for (const minutes of ordered) {
    const parsed = parsePriceInput(prices[minutes] ?? "");
    if (parsed) return parsed;
  }
  return "";
}

/** String inputs for the coach price rows. 0 is blank, not the character "0". */
export function initialPriceInputs(
  durations: readonly number[],
  service: PricedService | null | undefined,
  emptyFallback = "",
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const minutes of durations) {
    if (!service) {
      out[minutes] = emptyFallback;
      continue;
    }
    const n = priceForDuration(service, minutes);
    out[minutes] = n > 0 ? String(n) : emptyFallback;
  }
  return out;
}

/** Payload for save, or null when any enabled length is missing a valid price. */
export function durationPricesFromInputs(durations: readonly number[], prices: Record<number, string>) {
  if (!durations.length) return null;
  const durationPrices: Record<number, number> = {};
  for (const minutes of durations) {
    const n = priceInputToCad(prices[minutes] ?? "");
    if (n == null) return null;
    durationPrices[minutes] = n;
  }
  const shortest = [...durations].sort((a, b) => a - b)[0];
  return { durationPrices, priceCad: durationPrices[shortest] };
}
