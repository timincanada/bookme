export function pickLocation<T extends { id: string }>(
  locations: T[],
  locationId?: string | null,
): { ok: true; location: T } | { ok: false; error: string } {
  if (locations.length === 0) return { ok: false, error: "Coach is not set up" };
  if (locations.length === 1) return { ok: true, location: locations[0] };
  if (!locationId) return { ok: false, error: "Choose a location" };
  const location = locations.find((l) => l.id === locationId);
  if (!location) return { ok: false, error: "That location is not available" };
  return { ok: true, location };
}

export function mustChooseLocation(count: number) {
  return count > 1;
}
