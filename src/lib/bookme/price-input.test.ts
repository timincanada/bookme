import assert from "node:assert/strict";
import {
  durationPricesFromInputs,
  initialPriceInputs,
  parsePriceInput,
  prefillDurationPrice,
  priceFieldError,
  priceInputToCad,
} from "./price-input.ts";

assert.equal(parsePriceInput(""), "");
assert.equal(parsePriceInput("0"), "");
assert.equal(parsePriceInput("00"), "");
assert.equal(parsePriceInput("095"), "95");
assert.equal(parsePriceInput("$85"), "85");
assert.equal(parsePriceInput("12.50"), "1250");
assert.equal(parsePriceInput("  60 min "), "60");

assert.equal(priceInputToCad(""), null);
assert.equal(priceInputToCad("0"), null);
assert.equal(priceInputToCad("85"), 85);
assert.equal(priceInputToCad("10000"), 10000);
assert.equal(priceInputToCad("10001"), null);

assert.equal(priceFieldError(""), "Enter a price");
assert.equal(priceFieldError("0"), "Enter a price");
assert.equal(priceFieldError("40"), null);
assert.match(priceFieldError("10001") || "", /10000/);

assert.equal(prefillDurationPrice({ 30: "55", 60: "" }, [30, 60]), "55");
assert.equal(prefillDurationPrice({ 60: "85" }, [60]), "85");
assert.equal(prefillDurationPrice({}, [30]), "");

assert.deepEqual(initialPriceInputs([30, 60], null, "80"), { 30: "80", 60: "80" });
assert.deepEqual(
  initialPriceInputs([30, 60], { priceCad: 55, durationPrices: { "30": 55, "60": 85 } }),
  { 30: "55", 60: "85" },
);
assert.deepEqual(initialPriceInputs([60], { priceCad: 0 }), { 60: "" });

const payload = durationPricesFromInputs([60, 30], { 30: "55", 60: "85" });
assert.deepEqual(payload, { durationPrices: { 30: 55, 60: 85 }, priceCad: 55 });
assert.equal(durationPricesFromInputs([30, 60], { 30: "", 60: "85" }), null);
assert.equal(durationPricesFromInputs([30], { 30: "0" }), null);

console.log("price-input tests ok");
