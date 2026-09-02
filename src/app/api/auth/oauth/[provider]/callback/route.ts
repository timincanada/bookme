import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OAUTH_STATE_COOKIE,
  errorReturnPath,
  exchangeOAuthCode,
  isOAuthProvider,
  oauthRedirectUri,
  readOAuthState,
  resolveCoachFromOAuth,
  type OAuthProvider,
  type OAuthStore,
} from "@/lib/oauth";

function prismaOAuthStore(): OAuthStore {
  return {
    async findAccount(provider, providerUserId) {
      const row = await prisma.coachOAuthAccount.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } },
      });
      return row;
    },
    async findCoachById(id) {
      return prisma.coach.findUnique({ where: { id } });
    },
    async findCoachByEmail(email) {
      return prisma.coach.findUnique({ where: { email } });
    },
    async findCoachBySlug(slug) {
      return prisma.coach.findUnique({ where: { slug } });
    },
    async createCoach(data) {
      return prisma.coach.create({
        data: {
          name: data.name,
          email: data.email,
          slug: data.slug,
          title: data.title,
          city: data.city,
          timezone: data.timezone,
          passwordHash: data.passwordHash,
        },
      });
    },
    async createAccount(data) {
      await prisma.coachOAuthAccount.create({ data });
    },
  };
}

function fail(req: NextRequest, from: "login" | "register", message: string) {
  const res = NextResponse.redirect(new URL(errorReturnPath(from, message), req.nextUrl.origin));
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const stored = readOAuthState(req.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const from = stored?.from === "register" ? "register" : "login";
  const providerParam = params.provider;
  if (!isOAuthProvider(providerParam)) {
    return fail(req, from, "Could not sign in");
  }
  const provider: OAuthProvider = providerParam;

  if (req.nextUrl.searchParams.get("error")) {
    return fail(req, from, "Could not sign in");
  }

  if (!stored || stored.provider !== provider) {
    return fail(req, from, "Could not sign in");
  }
  const nonce = req.nextUrl.searchParams.get("state");
  if (!nonce || nonce !== stored.nonce) {
    return fail(req, from, "Could not sign in");
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail(req, from, "Could not sign in");

  const redirectUri = oauthRedirectUri(provider, req.nextUrl.origin);
  let profile;
  try {
    profile = await exchangeOAuthCode(provider, code, redirectUri, stored.verifier);
  } catch {
    return fail(req, from, "Could not sign in");
  }

  let coach;
  try {
    coach = await resolveCoachFromOAuth(
      {
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
      },
      prismaOAuthStore(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sign in";
    return fail(req, from, message);
  }

  const full = await prisma.coach.findUnique({
    where: { id: coach.id },
    include: { services: true, locations: true, hours: true },
  });
  const setupDone = Boolean(full?.title && full.services[0] && full.locations.length && full.hours.length);
  const dest = setupDone ? "/app/schedule" : "/app/setup";
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SESSION_COOKIE, signSession(coach.id), sessionCookieOptions());
  return res;
}
