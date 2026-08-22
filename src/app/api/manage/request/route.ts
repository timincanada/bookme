import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { manageLinkMail, sendMail } from "@/lib/mail";
import { magicExpiresAt, makeCode, makeToken, normalizeEmail } from "@/lib/magic";
import { appUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const client = await prisma.client.findUnique({ where: { email } });
  if (client) {
    await prisma.manageLink.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = makeToken();
    const code = makeCode();
    await prisma.manageLink.create({
      data: { email, token, code, expiresAt: magicExpiresAt() },
    });
    await sendMail(
      manageLinkMail({
        email,
        code,
        link: `${appUrl()}/manage?token=${token}`,
      }),
    );
  }
  return NextResponse.json({ sent: true });
}
