import { NextRequest, NextResponse } from "next/server";
import {
  authorizeUrl,
  errorPagePath,
  isOAuthProvider,
  newOAuthState,
  OAUTH_NOT_CONFIGURED,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
  oauthStateCookieOptions,
  providerConfigured,
  providerDownCopy,
  signOAuthState,
} from "@/lib/oauth";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const from = req.nextUrl.searchParams.get("from") === "register" ? "register" : "login";
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const origin = req.nextUrl.origin;
  if (!providerConfigured(provider)) {
    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json") && !accept.includes("text/html")) {
      return NextResponse.json({ error: OAUTH_NOT_CONFIGURED }, { status: 503 });
    }
    return NextResponse.redirect(new URL(errorPagePath(from, providerDownCopy(provider)), origin));
  }
  const state = newOAuthState(provider, from);
  const redirectUri = oauthRedirectUri(provider);
  const res = NextResponse.redirect(authorizeUrl(provider, redirectUri, state));
  res.cookies.set(OAUTH_STATE_COOKIE, signOAuthState(state), oauthStateCookieOptions());
  return res;
}
