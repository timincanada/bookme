import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STUDENT_COOKIE, signStudent, studentCookieOptions } from "@/lib/auth";
import { isMagicOpen, normalizeEmail } from "@/lib/magic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const code = String(body.code || "").trim();
  const email = normalizeEmail(body.email);
  const link = token
    ? await prisma.manageLink.findUnique({ where: { token } })
    : email && code
      ? await prisma.manageLink.findFirst({
          where: { email, code, usedAt: null },
          orderBy: { createdAt: "desc" },
        })
      : null;
  if (!link || !isMagicOpen(link)) {
    return NextResponse.json({ error: "That link or code is invalid or already used" }, { status: 401 });
  }
  await prisma.manageLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() },
  });
  const res = NextResponse.json({ email: link.email });
  res.cookies.set(STUDENT_COOKIE, signStudent(link.email), studentCookieOptions());
  return res;
}
