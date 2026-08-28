import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionCookieOptions, signSession, STAFF_COOKIE, verifyPassword } from "@/lib/auth";
import { normalizeEmail } from "@/lib/admin";
import { currentCoach, ensureStaff } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const coach = await currentCoach();
    if (coach) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    await ensureStaff();
    const staff = await prisma.staff.findUnique({ where: { email: normalizeEmail(email) } });
    if (!staff || !verifyPassword(password, staff.passwordHash)) {
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(STAFF_COOKIE, signSession(staff.id), sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("staff login failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
