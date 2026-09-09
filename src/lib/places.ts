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

/** Extract city/locality from Google address_components. */
export function cityFromAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined | null,
): string | null {
  if (!components?.length) return null;
  const byType = (t: string) => components.find((c) => c.types.includes(t));
  const locality = byType("locality") || byType("postal_town") || byType("sublocality") || byType("administrative_area_level_2");
  const region = byType("administrative_area_level_1");
  if (!locality) return region?.short_name || null;
  if (region?.short_name) return `${locality.long_name}, ${region.short_name}`;
  return locality.long_name;
}
