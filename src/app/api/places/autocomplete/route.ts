import { NextRequest, NextResponse } from "next/server";
import { googleMapsApiKey, isPlacesConfigured, type PlaceSuggestion } from "@/lib/places";

export async function GET(req: NextRequest) {
  if (!isPlacesConfigured()) {
    return NextResponse.json({ configured: false, suggestions: [] as PlaceSuggestion[] }, { status: 503 });
  }
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ configured: true, suggestions: [] as PlaceSuggestion[] });
  }
  const key = googleMapsApiKey()!;
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("key", key);
  url.searchParams.set("types", "address");
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { configured: true, suggestions: [], error: data.status, allowManual: true },
        { status: 502 },
      );
    }
    const suggestions: PlaceSuggestion[] = (data.predictions || []).slice(0, 6).map(
      (p: {
        place_id: string;
        description: string;
        structured_formatting?: { main_text?: string; secondary_text?: string };
      }) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || "",
      }),
    );
    return NextResponse.json({ configured: true, suggestions });
  } catch {
    return NextResponse.json(
      { configured: true, suggestions: [], error: "Places request failed", allowManual: true },
      { status: 502 },
    );
  }
}
