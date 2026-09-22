import assert from "node:assert/strict";
import { cityFromAddressComponents, isPlacesConfigured, googleMapsApiKey } from "./places.ts";

assert.equal(isPlacesConfigured({}), false);
assert.equal(isPlacesConfigured({ GOOGLE_MAPS_API_KEY: "" }), false);
assert.equal(isPlacesConfigured({ GOOGLE_MAPS_API_KEY: "   " }), false);
assert.equal(isPlacesConfigured({ GOOGLE_MAPS_API_KEY: "AIza-test" }), true);
assert.equal(googleMapsApiKey({ GOOGLE_MAPS_API_KEY: "  abc  " }), "abc");
assert.equal(googleMapsApiKey({}), null);

const city = cityFromAddressComponents([
  { long_name: "180", short_name: "180", types: ["street_number"] },
  { long_name: "Krieghoff Avenue", short_name: "Krieghoff Ave", types: ["route"] },
  { long_name: "Markham", short_name: "Markham", types: ["locality", "political"] },
  { long_name: "Ontario", short_name: "ON", types: ["administrative_area_level_1", "political"] },
  { long_name: "Canada", short_name: "CA", types: ["country", "political"] },
]);
assert.equal(city, "Markham, ON");

assert.equal(cityFromAddressComponents(null), null);
assert.equal(cityFromAddressComponents([]), null);

console.log("places tests ok");
