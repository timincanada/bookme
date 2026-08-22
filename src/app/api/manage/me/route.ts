import { NextResponse } from "next/server";
import { currentStudentEmail } from "@/lib/session";

export async function GET() {
  const email = currentStudentEmail();
  if (!email) return NextResponse.json({ email: null }, { status: 401 });
  return NextResponse.json({ email });
}
