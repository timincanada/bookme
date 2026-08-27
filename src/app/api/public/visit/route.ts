import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VISITOR_COOKIE, visitorCookieOptions } from "@/lib/visitors";

export async function POST(req: NextRequest) {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const id = existing || randomUUID();
  try {
    await prisma.publicVisitor.upsert({
      where: { id },
      create: { id },
      update: {},
    });
  } catch (err) {
    console.error("public visitor upsert failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  if (!existing) {
    res.cookies.set(VISITOR_COOKIE, id, visitorCookieOptions());
  }
  return res;
}
