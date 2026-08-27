import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { planAfterPaidGrant } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const grant = body.grant;
  if (grant !== "paid" && grant !== "unpaid" && grant !== "") {
    return NextResponse.json({ error: "Invalid grant" }, { status: 400 });
  }

  const coach = await prisma.coach.findUnique({ where: { id: params.id } });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const data: { accessGrant: string; plan?: string } = { accessGrant: grant };
  if (grant === "paid") {
    data.plan = planAfterPaidGrant(coach.plan);
  }

  const updated = await prisma.coach.update({ where: { id: coach.id }, data });
  return NextResponse.json({ ok: true, accessGrant: updated.accessGrant, plan: updated.plan });
}
