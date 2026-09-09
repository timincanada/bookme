import { NextResponse } from "next/server";
import { isPlacesConfigured } from "@/lib/places";

export async function GET() {
  return NextResponse.json({ configured: isPlacesConfigured() });
}
