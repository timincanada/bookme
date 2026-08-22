import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { slugify } from "@/lib/setup";

export async function POST(req: NextRequest) {
  const { name, email, password, city } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  const exists = await prisma.coach.findUnique({ where: { email: String(email).toLowerCase() } });
  if (exists) return NextResponse.json({ error: "That email is already registered" }, { status: 409 });

  let slug = slugify(name);
  const taken = await prisma.coach.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const coach = await prisma.coach.create({
    data: {
      name,
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(password),
      slug,
      title: "",
      city: city || "",
      timezone: "America/Toronto",
    },
  });
  const res = NextResponse.json({ id: coach.id, slug: coach.slug, setup: false });
  res.cookies.set(SESSION_COOKIE, signSession(coach.id), sessionCookieOptions());
  return res;
}
