import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { slugify } from "./setup";

export const PROVIDERS = ["google", "facebook", "x"] as const;
export type OAuthProvider = (typeof PROVIDERS)[number];

export const OAUTH_STATE_COOKIE = "bookme_oauth_state";
export const OAUTH_NO_EMAIL = "That account did not share an email";
export const OAUTH_CLOSED = "This account is closed";
export const OAUTH_NOT_CONFIGURED = "Not configured";

export function isOAuthProvider(value: string | undefined | null): value is OAuthProvider {
  return PROVIDERS.includes(value as OAuthProvider);
}

export type CoachOAuthRecord = {
  id: string;
  email: string;
  name: string;
  banned: boolean;
  passwordHash: string | null;
  slug: string;
  title: string;
  city: string;
  timezone: string;
};

export type OAuthStore = {
  findAccount(provider: string, providerUserId: string): Promise<{ coachId: string } | null>;
  findCoachById(id: string): Promise<CoachOAuthRecord | null>;
  findCoachByEmail(email: string): Promise<CoachOAuthRecord | null>;
  findCoachBySlug(slug: string): Promise<CoachOAuthRecord | null>;
  createCoach(data: {
    name: string;
    email: string;
    slug: string;
    title: string;
    city: string;
    timezone: string;
    passwordHash: null;
  }): Promise<CoachOAuthRecord>;
  createAccount(data: { coachId: string; provider: string; providerUserId: string }): Promise<void>;
};

export async function resolveCoachFromOAuth(
  input: {
    provider: OAuthProvider | string;
    providerUserId: string;
    email?: string | null;
    name?: string | null;
  },
  store: OAuthStore,
): Promise<CoachOAuthRecord> {
  if (!isOAuthProvider(input.provider)) {
    throw new Error("Unknown provider");
  }
  const existing = await store.findAccount(input.provider, input.providerUserId);
  if (existing) {
    const coach = await store.findCoachById(existing.coachId);
    if (!coach) throw new Error("Could not sign in");
    if (coach.banned) throw new Error(OAUTH_CLOSED);
    return coach;
  }

  const email = String(input.email || "").trim().toLowerCase();
  if (!email) throw new Error(OAUTH_NO_EMAIL);

  const byEmail = await store.findCoachByEmail(email);
  if (byEmail) {
    if (byEmail.banned) throw new Error(OAUTH_CLOSED);
    await store.createAccount({
      coachId: byEmail.id,
      provider: input.provider,
      providerUserId: input.providerUserId,
    });
    return byEmail;
  }

  const name = String(input.name || "").trim() || "Coach";
  let slug = slugify(name);
  if (await store.findCoachBySlug(slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const coach = await store.createCoach({
    name,
    email,
    slug,
    title: "",
    city: "",
    timezone: "America/Toronto",
    passwordHash: null,
  });
  await store.createAccount({
    coachId: coach.id,
    provider: input.provider,
    providerUserId: input.providerUserId,
  });
  return coach;
}

export function providerConfigured(provider: OAuthProvider) {
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
  if (provider === "facebook") {
    return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
  }
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

function secret() {
  return process.env.AUTH_SECRET || "bookme-dev-secret";
}

export type OAuthState = {
  provider: OAuthProvider;
  from: "login" | "register";
  nonce: string;
  verifier: string;
};

export function signOAuthState(state: OAuthState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(`oauth:${payload}`).digest("hex");
  return `${payload}.${sig}`;
}

export function readOAuthState(token: string | undefined | null): OAuthState | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expect = createHmac("sha256", secret()).update(`oauth:${payload}`).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!isOAuthProvider(parsed.provider)) return null;
    if (parsed.from !== "login" && parsed.from !== "register") return null;
    if (!parsed.nonce || !parsed.verifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function newOAuthState(provider: OAuthProvider, from: "login" | "register"): OAuthState {
  return {
    provider,
    from,
    nonce: randomBytes(16).toString("hex"),
    verifier: randomBytes(32).toString("base64url"),
  };
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };
}

export function oauthRedirectUri(provider: string, origin: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "");
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export function errorReturnPath(from: "login" | "register", message: string) {
  const page = from === "register" ? "/app/register" : "/app/login";
  return `${page}?error=${encodeURIComponent(message)}`;
}

export function authorizeUrl(provider: OAuthProvider, redirectUri: string, state: OAuthState) {
  const s = encodeURIComponent(state.nonce);
  const redirect = encodeURIComponent(redirectUri);
  if (provider === "google") {
    const clientId = encodeURIComponent(process.env.GOOGLE_CLIENT_ID || "");
    const scope = encodeURIComponent("openid email profile");
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}&state=${s}&prompt=select_account`;
  }
  if (provider === "facebook") {
    const clientId = encodeURIComponent(process.env.FACEBOOK_APP_ID || "");
    const scope = encodeURIComponent("email");
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirect}&state=${s}&scope=${scope}`;
  }
  const clientId = encodeURIComponent(process.env.X_CLIENT_ID || "");
  const challenge = encodeURIComponent(pkceChallenge(state.verifier));
  const scope = encodeURIComponent("users.read tweet.read offline.access");
  return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}&state=${s}&code_challenge=${challenge}&code_challenge_method=S256`;
}

export type ProviderProfile = {
  providerUserId: string;
  email?: string | null;
  name?: string | null;
};

export async function exchangeOAuthCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderProfile> {
  if (provider === "google") {
    const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token");
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("token");
    const userRes = await fetchImpl("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userRes.ok) throw new Error("user");
    const user = (await userRes.json()) as { id?: string; email?: string; name?: string };
    if (!user.id) throw new Error("user");
    return { providerUserId: String(user.id), email: user.email, name: user.name };
  }

  if (provider === "facebook") {
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID || "");
    tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET || "");
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetchImpl(tokenUrl.toString());
    if (!tokenRes.ok) throw new Error("token");
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("token");
    const userUrl = new URL("https://graph.facebook.com/me");
    userUrl.searchParams.set("fields", "id,name,email");
    userUrl.searchParams.set("access_token", token.access_token);
    const userRes = await fetchImpl(userUrl.toString());
    if (!userRes.ok) throw new Error("user");
    const user = (await userRes.json()) as { id?: string; email?: string; name?: string };
    if (!user.id) throw new Error("user");
    return { providerUserId: String(user.id), email: user.email, name: user.name };
  }

  const basic = Buffer.from(`${process.env.X_CLIENT_ID || ""}:${process.env.X_CLIENT_SECRET || ""}`).toString("base64");
  const tokenRes = await fetchImpl("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: process.env.X_CLIENT_ID || "",
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error("token");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("token");
  const userRes = await fetchImpl("https://api.twitter.com/2/users/me?user.fields=confirmed_email,name,username", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) throw new Error("user");
  const body = (await userRes.json()) as {
    data?: { id?: string; name?: string; username?: string; confirmed_email?: string; email?: string };
  };
  const user = body.data;
  if (!user?.id) throw new Error("user");
  return {
    providerUserId: String(user.id),
    email: user.confirmed_email || user.email,
    name: user.name || user.username,
  };
}
