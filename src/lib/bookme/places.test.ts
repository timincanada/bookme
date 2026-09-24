import assert from "node:assert/strict";
import { cityFromAddressComponents, googleMapsApiKey, isPlacesConfigured, lookupPlace, searchPlaces, type PlacesFetch } from "./places.ts";

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
assert.equal(
  cityFromAddressComponents([
    { longText: "Markham", shortText: "Markham", types: ["locality"] },
    { longText: "Ontario", shortText: "ON", types: ["administrative_area_level_1"] },
  ]),
  "Markham, ON",
);

const KEY = "test-key";
const ENV = { GOOGLE_MAPS_API_KEY: KEY } as NodeJS.ProcessEnv;

type Call = { url: string; init?: RequestInit };

function mockFetch(handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }): {
  calls: Call[];
  fetchImpl: PlacesFetch;
} {
  const calls: Call[] = [];
  const fetchImpl: PlacesFetch = async (url, init) => {
    calls.push({ url, init });
    const hit = handler(url, init);
    return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200 });
  };
  return { calls, fetchImpl };
}

function postBody(call: Call) {
  return JSON.parse(String(call.init?.body || "{}")) as Record<string, unknown>;
}

const markhamNew = {
  suggestions: [
    {
      placePrediction: {
        placeId: "ChIJmarkham",
        text: { text: "180 Krieghoff Avenue, Markham, ON, Canada" },
        structuredFormat: {
          mainText: { text: "180 Krieghoff Avenue" },
          secondaryText: { text: "Markham, ON, Canada" },
        },
      },
    },
  ],
};

async function testSearch() {
  const unconfigured = await searchPlaces("180 Krieghoff", {}, async () => {
    throw new Error("should not fetch");
  });
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.allowManual, true);

  const short = await searchPlaces("a", ENV, async () => {
    throw new Error("should not fetch");
  });
  assert.deepEqual(short.suggestions, []);
  assert.equal(short.error, undefined);

  {
    const { calls, fetchImpl } = mockFetch((url) => {
      assert.match(url, /places:autocomplete/);
      return { body: markhamNew };
    });
    const found = await searchPlaces("180 Krieghoff", ENV, fetchImpl);
    assert.equal(calls.length, 1);
    const body = postBody(calls[0]);
    assert.deepEqual(body.includedRegionCodes, ["us", "ca"]);
    assert.equal(body.includedPrimaryTypes, undefined);
    assert.equal((body.locationBias as { rectangle?: unknown }).rectangle != null, true);
    assert.equal(String(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>)["X-Goog-Api-Key"]), KEY);
    assert.equal(found.suggestions.length, 1);
    assert.equal(found.suggestions[0].placeId, "ChIJmarkham");
    assert.equal(found.suggestions[0].mainText, "180 Krieghoff Avenue");
    assert.equal(found.suggestions[0].secondaryText, "Markham, ON, Canada");
    assert.equal(found.error, undefined);
  }

  {
    const { calls, fetchImpl } = mockFetch((url) => {
      if (url.includes("places:autocomplete")) {
        return { status: 403, body: { error: { status: "PERMISSION_DENIED", message: `bad ${KEY}` } } };
      }
      assert.match(url, /place\/autocomplete/);
      return {
        body: {
          status: "OK",
          predictions: [
            {
              place_id: "ChIJlegacy",
              description: "1600 Amphitheatre Parkway, Mountain View, CA, USA",
              structured_formatting: { main_text: "1600 Amphitheatre Parkway", secondary_text: "Mountain View, CA, USA" },
            },
          ],
        },
      };
    });
    const found = await searchPlaces("1600 Amphitheatre", ENV, fetchImpl);
    assert.equal(found.suggestions[0].placeId, "ChIJlegacy");
    const legacy = new URL(calls[1].url);
    assert.equal(legacy.searchParams.get("types"), null);
    assert.equal(legacy.searchParams.get("components"), "country:us|country:ca");
    assert.equal(found.error, undefined);
    assert.equal(JSON.stringify(found).includes(KEY), false);
  }

  {
    const { fetchImpl } = mockFetch((url) => {
      if (url.includes("places:autocomplete")) return { body: { suggestions: [] } };
      if (url.includes("place/autocomplete")) return { body: { status: "ZERO_RESULTS", predictions: [] } };
      assert.match(url, /geocode/);
      return {
        body: {
          status: "OK",
          results: [
            { place_id: "ChIJgeo", formatted_address: "180 Krieghoff Ave, Markham, ON L3R 0G9, Canada" },
          ],
        },
      };
    });
    const found = await searchPlaces("180 Krieghoff Ave", ENV, fetchImpl);
    assert.equal(found.suggestions[0].placeId, "ChIJgeo");
    assert.equal(found.suggestions[0].mainText, "180 Krieghoff Ave");
    assert.match(found.suggestions[0].secondaryText, /Markham/);
  }

  {
    const { fetchImpl } = mockFetch((url) => {
      if (url.includes("geocode")) return { body: { status: "ZERO_RESULTS", results: [] } };
      if (url.includes("place/autocomplete")) return { body: { status: "ZERO_RESULTS", predictions: [] } };
      return { body: { suggestions: [] } };
    });
    const empty = await searchPlaces("180 Nowhere Road", ENV, fetchImpl);
    assert.equal(empty.empty, true);
    assert.equal(empty.allowManual, true);
    assert.equal(empty.error, undefined);
    assert.deepEqual(empty.suggestions, []);
  }

  {
    const { fetchImpl } = mockFetch((url) => {
      if (url.includes("places:autocomplete")) {
        return { status: 403, body: { error: { status: "PERMISSION_DENIED", message: KEY } } };
      }
      if (url.includes("geocode")) return { body: { status: "REQUEST_DENIED", error_message: KEY } };
      return { body: { status: "REQUEST_DENIED", error_message: `key=${KEY}` } };
    });
    const denied = await searchPlaces("180 Krieghoff Avenue", ENV, fetchImpl);
    assert.equal(denied.error, "REQUEST_DENIED");
    assert.equal(denied.allowManual, true);
    assert.equal(JSON.stringify(denied).includes(KEY), false);
  }
}

async function testLookup() {
  {
    const { calls, fetchImpl } = mockFetch((url) => {
      if (url.includes("places.googleapis.com")) {
        assert.match(url, /\/places\/ChIJmarkham/);
        return {
          body: {
            id: "ChIJmarkham",
            formattedAddress: "180 Krieghoff Ave, Markham, ON L3R 0G9, Canada",
            location: { latitude: 43.89, longitude: -79.3 },
            addressComponents: [
              { longText: "Markham", shortText: "Markham", types: ["locality"] },
              { longText: "Ontario", shortText: "ON", types: ["administrative_area_level_1"] },
            ],
          },
        };
      }
      assert.match(url, /timezone/);
      return { body: { status: "OK", timeZoneId: "America/Toronto" } };
    });
    const place = await lookupPlace("places/ChIJmarkham", ENV, fetchImpl);
    assert.equal(place.ok, true);
    if (!place.ok) return;
    assert.equal(place.placeId, "ChIJmarkham");
    assert.equal(place.lat, 43.89);
    assert.equal(place.lng, -79.3);
    assert.equal(place.city, "Markham, ON");
    assert.equal(place.timezone, "America/Toronto");
    assert.equal(place.formattedAddress.includes("Krieghoff"), true);
    const mask = calls[0].init?.headers as Record<string, string>;
    assert.match(mask["X-Goog-FieldMask"], /location/);
  }

  {
    const { calls, fetchImpl } = mockFetch((url) => {
      if (url.includes("places.googleapis.com")) return { status: 403, body: { error: { status: "PERMISSION_DENIED" } } };
      if (url.includes("place/details")) {
        return {
          body: {
            status: "OK",
            result: {
              place_id: "ChIJlegacy",
              formatted_address: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
              geometry: { location: { lat: 37.42, lng: -122.08 } },
              address_components: [
                { long_name: "Mountain View", short_name: "Mountain View", types: ["locality"] },
                { long_name: "California", short_name: "CA", types: ["administrative_area_level_1"] },
              ],
            },
          },
        };
      }
      return { body: { status: "OK", timeZoneId: "America/Los_Angeles" } };
    });
    const place = await lookupPlace("ChIJlegacy", ENV, fetchImpl);
    assert.equal(place.ok, true);
    if (!place.ok) return;
    assert.equal(place.lat, 37.42);
    assert.equal(place.lng, -122.08);
    assert.equal(place.city, "Mountain View, CA");
    const fields = new URL(calls.find((c) => c.url.includes("place/details"))!.url).searchParams.get("fields");
    assert.equal(fields, "place_id,formatted_address,geometry,address_components");
  }

  {
    const { fetchImpl } = mockFetch((url) => {
      if (url.includes("places.googleapis.com/v1/places/")) {
        return { body: { id: "ChIJpartial", formattedAddress: "180 Krieghoff Ave, Markham, ON, Canada" } };
      }
      if (url.includes("geocode")) {
        return { body: { status: "OK", results: [{ geometry: { location: { lat: 43.9, lng: -79.31 } } }] } };
      }
      return { body: { status: "ZERO_RESULTS" } };
    });
    const place = await lookupPlace("ChIJpartial", ENV, fetchImpl);
    assert.equal(place.ok, true);
    if (!place.ok) return;
    assert.equal(place.lat, 43.9);
    assert.equal(place.lng, -79.31);
    assert.equal(place.timezone, null);
  }

  const missing = await lookupPlace("ChIJ", {}, async () => {
    throw new Error("should not fetch");
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.allowManual, true);
}

Promise.all([testSearch(), testLookup()])
  .then(() => console.log("places tests ok"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
