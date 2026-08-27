import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifyPassword } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const coach = await prisma.coach.findUnique({
      where: { email: String(email).toLowerCase() },
      include: { services: true, locations: true, hours: true },
    });
    if (!coach || !verifyPassword(password, coach.passwordHash)) {
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    if (coach.banned) {
      return NextResponse.json({ error: "This account is closed" }, { status: 401 });
    }
    const res = NextResponse.json({
      id: coach.id,
      slug: coach.slug,
      setup: Boolean(coach.title && coach.services[0] && coach.locations.length && coach.hours.length),
      admin: isAdminEmail(coach.email),
    });
    res.cookies.set(SESSION_COOKIE, signSession(coach.id), sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("login failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
