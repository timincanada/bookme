import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_NOT_CONFIGURED,
  OAUTH_STATE_COOKIE,
  authorizeUrl,
  isOAuthProvider,
  newOAuthState,
  oauthRedirectUri,
  oauthStateCookieOptions,
  providerConfigured,
  signOAuthState,
} from "@/lib/oauth";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const from = req.nextUrl.searchParams.get("from") === "register" ? "register" : "login";
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  if (!providerConfigured(provider)) {
    return NextResponse.json({ error: OAUTH_NOT_CONFIGURED }, { status: 503 });
  }
  const state = newOAuthState(provider, from);
  const redirectUri = oauthRedirectUri(provider, req.nextUrl.origin);
  const res = NextResponse.redirect(authorizeUrl(provider, redirectUri, state));
  res.cookies.set(OAUTH_STATE_COOKIE, signOAuthState(state), oauthStateCookieOptions());
  return res;
}
