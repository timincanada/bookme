import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "tim-zhang";
  const coach = await prisma.coach.findUnique({ where: { slug } });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  return NextResponse.json({
    status: coach.subscriptionStatus,
    trialEndsAt: coach.trialEndsAt,
  });
}
