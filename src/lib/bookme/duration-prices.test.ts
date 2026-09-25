import assert from "node:assert/strict";
import {
  listedFromPrice,
  normalizeDurationPrices,
  parseDurationPrices,
  priceForDuration,
  servicePricesDiffer,
  validateDurationPrices,
} from "./duration-prices.ts";

assert.equal(priceForDuration({ priceCad: 85 }, 30), 85);
assert.equal(priceForDuration({ price_cad: 85 }, 60), 85);
assert.equal(priceForDuration({ priceCad: 55, durationPrices: { "30": 55, "60": 85 } }, 30), 55);
assert.equal(priceForDuration({ priceCad: 55, durationPrices: { "30": 55, "60": 85 } }, 60), 85);
assert.equal(priceForDuration({ priceCad: 55, durationPrices: { "30": 55 } }, 90), 55, "missing key falls back");
assert.equal(priceForDuration({ price_cad: 40, duration_prices: { "45": 70 } }, 45), 70);

const parsed = parseDurationPrices('{"30":60,"60":"85","nope":12,"10":0}');
assert.deepEqual(parsed, { "30": 60, "60": 85 });
assert.equal(parseDurationPrices(null), null);
assert.equal(parseDurationPrices("not json"), null);

const filled = normalizeDurationPrices([60, 30], { 60: 90 }, 40);
assert.deepEqual(filled, { "60": 90, "30": 40 });
assert.equal(normalizeDurationPrices([30], { 30: 0 }, 40)["30"], 0, "explicit 0 is not replaced");
assert.equal(normalizeDurationPrices([30], { 30: "" }, 40)["30"], 40);

const ok = validateDurationPrices([60, 30], { "30": 55, "60": 85 });
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.priceCad, 55, "price_cad is the shortest length");
  assert.deepEqual(ok.prices, { "30": 55, "60": 85 });
}
const missing = validateDurationPrices([30], { "30": 0 });
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.error, "Enter a price");
const huge = validateDurationPrices([60], { "60": 10001 });
assert.equal(huge.ok, false);
if (!huge.ok) assert.match(huge.error, /10000/);
assert.equal(validateDurationPrices([60], { "60": 10000 }).ok, true);

const services = [
  { priceCad: 55, duration: 30, durations: [30, 60], durationPrices: { "30": 55, "60": 85 } },
  { priceCad: 40, duration: 45, durations: [45] },
];
assert.equal(listedFromPrice(services), 40);
assert.equal(servicePricesDiffer(services[0]), true);
assert.equal(servicePricesDiffer(services[1]), false);
assert.equal(priceForDuration(services[0], 60), 85, "booking price follows the chosen length");

console.log("duration-prices tests ok");
