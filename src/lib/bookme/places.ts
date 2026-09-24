import { isValidTimezone } from "./timezone";

export function isPlacesConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
}

export function googleMapsApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type PlaceDetails = {
  placeId: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  timezone: string | null;
};

export type PlacesSearchResult = {
  configured: boolean;
  suggestions: PlaceSuggestion[];
  /** Search ran and returned nothing. The typed address can still be saved. */
  empty?: boolean;
  allowManual?: boolean;
  /** Short status token. Never a Google error_message (those can echo the key). */
  error?: string;
};

export type PlaceLookupResult =
  | {
      ok: true;
      placeId: string;
      formattedAddress: string;
      lat: number;
      lng: number;
      city: string | null;
      timezone: string | null;
    }
  | { ok: false; error: string; allowManual: true };

type AddressComponentLike = {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type PlacesFetch = (url: string, init?: RequestInit) => Promise<Response>;

const PLACES_TIMEOUT_MS = 8_000;
const SUGGESTION_LIMIT = 6;

/**
 * Server calls come from a datacenter IP. Without an explicit bias, Places
 * ranks results around that IP and common Canadian street addresses fall off
 * the short list. The box covers the populated US and Canada.
 */
const NA_BIAS = {
  rectangle: {
    low: { latitude: 24, longitude: -141 },
    high: { latitude: 70, longitude: -52 },
  },
};

async function defaultFetch(url: string, init?: RequestInit) {
  return fetch(url, init);
}

function publicPlacesError(status: unknown): string {
  const s = String(status || "");
  if (s === "PERMISSION_DENIED" || s === "REQUEST_DENIED" || s === "403") return "REQUEST_DENIED";
  if (/^[A-Z0-9_]{3,40}$/.test(s)) return s;
  return "Places request failed";
}

async function fetchJson(fetchImpl: PlacesFetch, url: string, init?: RequestInit) {
  try {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(PLACES_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body: body as Record<string, unknown> | null };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

function barePlaceId(id: string) {
  const trimmed = id.trim();
  return trimmed.startsWith("places/") ? trimmed.slice("places/".length) : trimmed;
}

function suggestion(placeId: string, description: string, mainText: string, secondaryText: string): PlaceSuggestion | null {
  const id = barePlaceId(placeId);
  const text = description.trim();
  if (!id || !text) return null;
  return {
    placeId: id,
    description: text,
    mainText: mainText.trim() || text,
    secondaryText: secondaryText.trim(),
  };
}

function takeSuggestions(items: Array<PlaceSuggestion | null>) {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const item of items) {
    if (!item || seen.has(item.placeId)) continue;
    seen.add(item.placeId);
    out.push(item);
    if (out.length >= SUGGESTION_LIMIT) break;
  }
  return out;
}

type Attempt =
  | { kind: "ok"; suggestions: PlaceSuggestion[] }
  | { kind: "error"; error: string };

/** Places API (New). No primary-type filter: `street_address` alone misses premises and partial streets. */
async function autocompleteNew(q: string, key: string, fetchImpl: PlacesFetch): Promise<Attempt> {
  const hit = await fetchJson(fetchImpl, "https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["us", "ca"],
      languageCode: "en",
      locationBias: NA_BIAS,
    }),
  });
  const error = hit.body?.error as { status?: string } | undefined;
  if (!hit.ok || error) return { kind: "error", error: publicPlacesError(error?.status || hit.status) };
  const suggestions = Array.isArray(hit.body?.suggestions) ? hit.body.suggestions : [];
  return {
    kind: "ok",
    suggestions: takeSuggestions(
      suggestions.map((raw) => {
        const prediction = (raw as { placePrediction?: Record<string, unknown> }).placePrediction;
        if (!prediction) return null;
        const structured = prediction.structuredFormat as
          | { mainText?: { text?: string }; secondaryText?: { text?: string } }
          | undefined;
        const full = (prediction.text as { text?: string } | undefined)?.text || "";
        return suggestion(
          String(prediction.placeId || prediction.place || ""),
          full,
          structured?.mainText?.text || full.split(",")[0] || full,
          structured?.secondaryText?.text || "",
        );
      }),
    ),
  };
}

/**
 * Legacy autocomplete. `types=address` returns ZERO_RESULTS for many real
 * North American streets (partial input, premises, newer subdivisions).
 * Country components keep the list in the US and Canada without that filter.
 */
async function autocompleteLegacy(q: string, key: string, fetchImpl: PlacesFetch): Promise<Attempt> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("components", "country:us|country:ca");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);
  const hit = await fetchJson(fetchImpl, url.toString());
  const status = String(hit.body?.status || "");
  if (!hit.ok || (status && status !== "OK" && status !== "ZERO_RESULTS")) {
    return { kind: "error", error: publicPlacesError(status || hit.status) };
  }
  const predictions = Array.isArray(hit.body?.predictions) ? hit.body.predictions : [];
  return {
    kind: "ok",
    suggestions: takeSuggestions(
      predictions.map((raw) => {
        const p = raw as {
          place_id?: string;
          description?: string;
          structured_formatting?: { main_text?: string; secondary_text?: string };
        };
        return suggestion(
          String(p.place_id || ""),
          String(p.description || ""),
          p.structured_formatting?.main_text || "",
          p.structured_formatting?.secondary_text || "",
        );
      }),
    ),
  };
}

async function geocodeSuggestions(q: string, key: string, fetchImpl: PlacesFetch): Promise<Attempt> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("components", "country:US|country:CA");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);
  const hit = await fetchJson(fetchImpl, url.toString());
  const status = String(hit.body?.status || "");
  if (!hit.ok || (status && status !== "OK" && status !== "ZERO_RESULTS")) {
    return { kind: "error", error: publicPlacesError(status || hit.status) };
  }
  const results = Array.isArray(hit.body?.results) ? hit.body.results : [];
  return {
    kind: "ok",
    suggestions: takeSuggestions(
      results.map((raw) => {
        const r = raw as { place_id?: string; formatted_address?: string };
        const full = String(r.formatted_address || "");
        const [main, ...rest] = full.split(",");
        return suggestion(String(r.place_id || ""), full, main || full, rest.join(",").trim());
      }),
    ),
  };
}

export async function searchPlaces(
  rawQuery: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PlacesFetch = defaultFetch,
): Promise<PlacesSearchResult> {
  const key = googleMapsApiKey(env);
  if (!key) return { configured: false, suggestions: [], allowManual: true };
  const q = rawQuery.trim();
  if (q.length < 2) return { configured: true, suggestions: [] };

  let sawSuccess = false;
  let lastError = "Places request failed";

  const newer = await autocompleteNew(q, key, fetchImpl);
  if (newer.kind === "ok") {
    sawSuccess = true;
    if (newer.suggestions.length) return { configured: true, suggestions: newer.suggestions };
  } else {
    lastError = newer.error;
    console.log(JSON.stringify({ msg: "places_search_failed", source: "autocomplete_new", status: newer.error }));
  }

  const older = await autocompleteLegacy(q, key, fetchImpl);
  if (older.kind === "ok") {
    sawSuccess = true;
    if (older.suggestions.length) return { configured: true, suggestions: older.suggestions };
  } else {
    lastError = older.error;
    console.log(JSON.stringify({ msg: "places_search_failed", source: "autocomplete_legacy", status: older.error }));
  }

  if (q.length >= 5) {
    const geo = await geocodeSuggestions(q, key, fetchImpl);
    if (geo.kind === "ok") {
      sawSuccess = true;
      if (geo.suggestions.length) return { configured: true, suggestions: geo.suggestions };
    } else if (!sawSuccess) {
      lastError = geo.error;
      console.log(JSON.stringify({ msg: "places_search_failed", source: "geocode", status: geo.error }));
    }
  }

  if (sawSuccess) return { configured: true, suggestions: [], empty: true, allowManual: true };
  return { configured: true, suggestions: [], error: lastError, allowManual: true };
}

function componentsOf(raw: unknown): AddressComponentLike[] | null {
  return Array.isArray(raw) ? (raw as AddressComponentLike[]) : null;
}

function finiteCoord(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function timezoneAt(lat: number, lng: number, key: string, fetchImpl: PlacesFetch): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("timestamp", String(Math.floor(Date.now() / 1000)));
  url.searchParams.set("key", key);
  const hit = await fetchJson(fetchImpl, url.toString());
  const id = hit.body?.timeZoneId;
  if (hit.body?.status === "OK" && typeof id === "string" && isValidTimezone(id)) return id;
  return null;
}

async function geocodePoint(address: string, key: string, fetchImpl: PlacesFetch) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);
  const hit = await fetchJson(fetchImpl, url.toString());
  if (hit.body?.status !== "OK" || !Array.isArray(hit.body.results)) return null;
  const first = hit.body.results[0] as {
    geometry?: { location?: { lat?: unknown; lng?: unknown } };
  };
  const lat = finiteCoord(first?.geometry?.location?.lat);
  const lng = finiteCoord(first?.geometry?.location?.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

type ResolvedPlace = {
  placeId: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  components: AddressComponentLike[] | null;
};

async function detailsNew(placeId: string, key: string, fetchImpl: PlacesFetch): Promise<ResolvedPlace | null | "error"> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`;
  const hit = await fetchJson(fetchImpl, url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
  });
  const error = hit.body?.error as { status?: string } | undefined;
  if (!hit.ok || error) return "error";
  const location = hit.body?.location as { latitude?: unknown; longitude?: unknown } | undefined;
  return {
    placeId: barePlaceId(String(hit.body?.id || placeId)),
    formattedAddress: String(hit.body?.formattedAddress || ""),
    lat: finiteCoord(location?.latitude),
    lng: finiteCoord(location?.longitude),
    components: componentsOf(hit.body?.addressComponents),
  };
}

async function detailsLegacy(placeId: string, key: string, fetchImpl: PlacesFetch): Promise<ResolvedPlace | null | "error"> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  // Plural `address_components`. The singular name is rejected as an unknown field.
  url.searchParams.set("fields", "place_id,formatted_address,geometry,address_components");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);
  const hit = await fetchJson(fetchImpl, url.toString());
  if (hit.body?.status !== "OK" || !hit.body.result || typeof hit.body.result !== "object") return "error";
  const result = hit.body.result as {
    place_id?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: unknown; lng?: unknown } };
    address_components?: unknown;
  };
  return {
    placeId: barePlaceId(String(result.place_id || placeId)),
    formattedAddress: String(result.formatted_address || ""),
    lat: finiteCoord(result.geometry?.location?.lat),
    lng: finiteCoord(result.geometry?.location?.lng),
    components: componentsOf(result.address_components),
  };
}

export async function lookupPlace(
  rawPlaceId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PlacesFetch = defaultFetch,
): Promise<PlaceLookupResult> {
  const key = googleMapsApiKey(env);
  if (!key) return { ok: false, error: "Address search unavailable", allowManual: true };
  const placeId = barePlaceId(rawPlaceId);
  if (!placeId) return { ok: false, error: "placeId required", allowManual: true };

  let resolved = await detailsNew(placeId, key, fetchImpl);
  if (resolved === "error" || (resolved && resolved.lat == null && resolved.lng == null && !resolved.formattedAddress)) {
    const legacy = await detailsLegacy(placeId, key, fetchImpl);
    if (legacy !== "error") resolved = legacy;
  }
  if (resolved === "error" || !resolved) return { ok: false, error: "Details failed", allowManual: true };

  let lat = resolved.lat;
  let lng = resolved.lng;
  if ((lat == null || lng == null) && resolved.formattedAddress) {
    const point = await geocodePoint(resolved.formattedAddress, key, fetchImpl);
    if (point) {
      lat = point.lat;
      lng = point.lng;
    }
  }
  if (lat == null || lng == null) return { ok: false, error: "Details failed", allowManual: true };

  const timezone = await timezoneAt(lat, lng, key, fetchImpl);
  return {
    ok: true,
    placeId: resolved.placeId || placeId,
    formattedAddress: resolved.formattedAddress,
    lat,
    lng,
    city: cityFromAddressComponents(resolved.components),
    timezone,
  };
}

/** Extract city/locality from Google address components (legacy or Places API New). */
export function cityFromAddressComponents(components: AddressComponentLike[] | undefined | null): string | null {
  if (!components?.length) return null;
  const longName = (c: AddressComponentLike) => c.long_name || c.longText || "";
  const shortName = (c: AddressComponentLike) => c.short_name || c.shortText || "";
  const byType = (t: string) => components.find((c) => c.types?.includes(t));
  const locality = byType("locality") || byType("postal_town") || byType("sublocality") || byType("administrative_area_level_2");
  const region = byType("administrative_area_level_1");
  if (!locality) return shortName(region || {}) || longName(region || {}) || null;
  const localityName = longName(locality);
  if (!localityName) return null;
  const regionName = shortName(region || {});
  if (regionName) return `${localityName}, ${regionName}`;
  return localityName;
}
