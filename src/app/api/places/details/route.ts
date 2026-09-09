import { NextRequest, NextResponse } from "next/server";
import { cityFromAddressComponents, googleMapsApiKey, isPlacesConfigured, type PlaceDetails } from "@/lib/places";
import { isValidTimezone } from "@/lib/timezone";

export async function GET(req: NextRequest) {
  if (!isPlacesConfigured()) {
    return NextResponse.json({ error: "Address search unavailable" }, { status: 503 });
  }
  const placeId = (req.nextUrl.searchParams.get("placeId") || "").trim();
  if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 });
  const key = googleMapsApiKey()!;
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,formatted_address,geometry,address_component");
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    if (data.status !== "OK" || !data.result) {
      return NextResponse.json({ error: data.status || "Details failed", allowManual: true }, { status: 502 });
    }
    const r = data.result;
    const lat = r.geometry?.location?.lat ?? null;
    const lng = r.geometry?.location?.lng ?? null;
    let timezone: string | null = null;
    if (typeof lat === "number" && typeof lng === "number") {
      try {
        const tzUrl = new URL("https://maps.googleapis.com/maps/api/timezone/json");
        tzUrl.searchParams.set("location", `${lat},${lng}`);
        tzUrl.searchParams.set("timestamp", String(Math.floor(Date.now() / 1000)));
        tzUrl.searchParams.set("key", key);
        const tzRes = await fetch(tzUrl.toString(), { next: { revalidate: 0 } });
        const tzData = await tzRes.json();
        if (tzData.status === "OK" && isValidTimezone(tzData.timeZoneId)) {
          timezone = tzData.timeZoneId;
        }
      } catch {
        timezone = null;
      }
    }
    const details: PlaceDetails = {
      placeId: r.place_id || placeId,
      formattedAddress: r.formatted_address || "",
      lat,
      lng,
      city: cityFromAddressComponents(r.address_components),
      timezone,
    };
    return NextResponse.json(details);
  } catch {
    return NextResponse.json({ error: "Details request failed", allowManual: true }, { status: 502 });
  }
}
