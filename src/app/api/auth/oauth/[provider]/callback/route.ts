import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  completeCoachOAuth,
  errorPagePath,
  exchangeOAuthCode,
  isOAuthProvider,
  mapCallbackQueryError,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
  providerDownCopy,
  readOAuthState,
  type CoachOAuthRecord,
  type OAuthProvider,
  type OAuthStore,
} from "@/lib/oauth";

const include = { services: true, locations: true, hours: true } as const;

function toRecord(coach: {
  id: string;
  email: string;
  banned: boolean;
  name: string;
  title: string | null;
  timezone: string | null;
  subscriptionStatus: string | null;
  services: { duration: number; priceCad: number }[];
  locations: unknown[];
  hours: unknown[];
}): CoachOAuthRecord {
  const service = coach.services[0];
  return {
    id: coach.id,
    email: coach.email,
    banned: coach.banned,
    name: coach.name,
    title: coach.title,
    timezone: coach.timezone,
    subscriptionStatus: coach.subscriptionStatus,
    service: service ? { duration: service.duration, priceCad: service.priceCad } : null,
    locationCount: coach.locations.length,
    hourCount: coach.hours.length,
  };
}

export function prismaOAuthStore(): OAuthStore {
  return {
    async findByProvider(provider, providerUserId) {
      const row = await prisma.coachOAuthAccount.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } },
        include: { coach: { include } },
      });
      return row ? toRecord(row.coach) : null;
    },
    async findByEmail(email) {
      const coach = await prisma.coach.findUnique({ where: { email }, include });
      return coach ? toRecord(coach) : null;
    },
    async slugTaken(slug) {
      const taken = await prisma.coach.findUnique({ where: { slug } });
      return Boolean(taken);
    },
    async createCoach(data) {
      const coach = await prisma.coach.create({
        data: {
          name: data.name,
          email: data.email,
          slug: data.slug,
          title: "",
          city: "",
          timezone: "America/Toronto",
        },
        include,
      });
      return toRecord(coach);
    },
    async bind(coachId, provider, providerUserId) {
      await prisma.coachOAuthAccount.upsert({
        where: { provider_providerUserId: { provider, providerUserId } },
        create: { coachId, provider, providerUserId },
        update: { coachId },
      });
    },
  };
}

function fail(req: NextRequest, from: "login" | "register", message: string) {
  const res = NextResponse.redirect(new URL(errorPagePath(from, message), req.nextUrl.origin));
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const providerParam = params.provider;
  const stored = readOAuthState(req.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const from = stored?.from === "register" ? "register" : "login";
  const provider: OAuthProvider | null = isOAuthProvider(providerParam)
    ? providerParam
    : stored && isOAuthProvider(stored.provider)
      ? stored.provider
      : null;
  if (!provider) {
    return NextResponse.redirect(new URL(errorPagePath(from, "Sign-in canceled."), req.nextUrl.origin));
  }

  const queryError = mapCallbackQueryError(
    {
      error: req.nextUrl.searchParams.get("error"),
      errorDescription: req.nextUrl.searchParams.get("error_description"),
      errorReason: req.nextUrl.searchParams.get("error_reason"),
    },
    provider,
  );
  if (queryError) return fail(req, from, queryError);

  if (!stored || stored.provider !== provider) {
    return fail(req, from, providerDownCopy(provider));
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail(req, from, providerDownCopy(provider));

  const redirectUri = oauthRedirectUri(provider);
  let profile;
  try {
    profile = await exchangeOAuthCode(provider, code, redirectUri, stored.verifier);
  } catch {
    return fail(req, from, providerDownCopy(provider));
  }

  const outcome = await completeCoachOAuth(prismaOAuthStore(), {
    provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    name: profile.name,
  });
  if (!outcome.ok) return fail(req, from, outcome.error);

  const dest = outcome.setup ? "/app/schedule" : "/app/setup";
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SESSION_COOKIE, signSession(outcome.coachId), sessionCookieOptions());
  return res;
}
