import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminEmail, requireAdmin } from "@/lib/admin";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const coach = await prisma.coach.findUnique({ where: { id: params.id } });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  if (isAdminEmail(coach.email)) {
    return NextResponse.json({ error: "Cannot ban this account" }, { status: 400 });
  }

  await prisma.coach.update({
    where: { id: coach.id },
    data: { banned: true },
  });
  return NextResponse.json({ ok: true, banned: true });
}
