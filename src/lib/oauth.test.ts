import assert from "node:assert/strict";
import {
  completeCoachOAuth,
  errorPagePath,
  isOAuthProvider,
  mapCallbackQueryError,
  missingEmailCopy,
  OAUTH_COPY,
  OAUTH_NOT_CONFIGURED,
  OAUTH_PROVIDERS,
  oauthErrorCopy,
  oauthRedirectUri,
  providerConfigured,
  providerDownCopy,
  providerLabel,
  readOAuthState,
  signOAuthState,
  type CoachOAuthRecord,
  type OAuthProvider,
  type OAuthStore,
} from "./oauth";

assert.deepEqual([...OAUTH_PROVIDERS], ["google", "facebook", "x"]);
assert.equal(isOAuthProvider("google"), true);
assert.equal(isOAuthProvider("facebook"), true);
assert.equal(isOAuthProvider("x"), true);
assert.equal(isOAuthProvider("apple"), false);
assert.equal(providerLabel("google"), "Google");
assert.equal(providerLabel("facebook"), "Facebook");
assert.equal(providerLabel("x"), "X");

assert.equal(OAUTH_COPY.cancel, "Sign-in canceled.");
assert.equal(OAUTH_COPY.deny, "Permission denied. Try email instead.");
assert.equal(OAUTH_COPY.staff, "This email is for the admin console. Use /admin.");
assert.equal(OAUTH_COPY.banned, "This account is disabled.");
assert.equal(missingEmailCopy("google"), "We need an email from Google to continue.");
assert.equal(missingEmailCopy("facebook"), "We need an email from Facebook to continue.");
assert.equal(missingEmailCopy("x"), "We need an email from X to continue.");
assert.equal(providerDownCopy("google"), "Couldn't reach Google. Try email or try again.");
assert.equal(providerDownCopy("facebook"), "Couldn't reach Facebook. Try email or try again.");
assert.equal(providerDownCopy("x"), "Couldn't reach X. Try email or try again.");
assert.equal(oauthErrorCopy("down", "google"), providerDownCopy("google"));
assert.equal(OAUTH_NOT_CONFIGURED, "Not configured");
assert.equal(errorPagePath("login", OAUTH_COPY.cancel), "/app/login?error=" + encodeURIComponent(OAUTH_COPY.cancel));
assert.equal(errorPagePath("register", OAUTH_COPY.staff).startsWith("/app/register?error="), true);

assert.equal(mapCallbackQueryError({ error: "access_denied", errorReason: "user_denied" }, "google"), OAUTH_COPY.cancel);
assert.equal(mapCallbackQueryError({ error: "user_cancelled" }, "facebook"), OAUTH_COPY.cancel);
assert.equal(mapCallbackQueryError({ error: "access_denied", errorDescription: "Permission was denied" }, "x"), OAUTH_COPY.deny);
assert.equal(mapCallbackQueryError({ error: "server_error" }, "google"), providerDownCopy("google"));
assert.equal(mapCallbackQueryError({ error: null }, "google"), null);

const prevUrl = process.env.NEXT_PUBLIC_APP_URL;
delete process.env.NEXT_PUBLIC_APP_URL;
assert.equal(oauthRedirectUri("google"), "https://bookme.training/api/auth/oauth/google/callback");
process.env.NEXT_PUBLIC_APP_URL = "https://bookme.training/";
assert.equal(oauthRedirectUri("x"), "https://bookme.training/api/auth/oauth/x/callback");
if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
else process.env.NEXT_PUBLIC_APP_URL = prevUrl;

const prevGoogleId = process.env.GOOGLE_CLIENT_ID;
const prevGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
assert.equal(providerConfigured("google"), false);
process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "secret";
assert.equal(providerConfigured("google"), true);
if (prevGoogleId === undefined) delete process.env.GOOGLE_CLIENT_ID;
else process.env.GOOGLE_CLIENT_ID = prevGoogleId;
if (prevGoogleSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
else process.env.GOOGLE_CLIENT_SECRET = prevGoogleSecret;

const signed = signOAuthState({ provider: "google", from: "login", nonce: "n1", verifier: "v1" });
const read = readOAuthState(signed);
assert.equal(read?.provider, "google");
assert.equal(read?.from, "login");
assert.equal(readOAuthState("bad.token"), null);

type Row = CoachOAuthRecord & { bindings: { provider: OAuthProvider; providerUserId: string }[] };

function memoryStore(seed: Row[] = []) {
  const coaches: Row[] = seed.map((c) => ({ ...c, bindings: [...c.bindings] }));
  const slugs = new Set(coaches.map((c) => c.id));
  const store: OAuthStore & { coaches: Row[]; createdCount: number } = {
    coaches,
    createdCount: 0,
    async findByProvider(provider, providerUserId) {
      return coaches.find((c) => c.bindings.some((b) => b.provider === provider && b.providerUserId === providerUserId)) || null;
    },
    async findByEmail(email) {
      return coaches.find((c) => c.email === email) || null;
    },
    async slugTaken(slug) {
      return slugs.has(slug);
    },
    async createCoach(data) {
      this.createdCount += 1;
      const row: Row = {
        id: `new-${this.createdCount}`,
        email: data.email,
        banned: false,
        name: data.name,
        title: "",
        timezone: "America/Toronto",
        subscriptionStatus: "none",
        service: null,
        locationCount: 0,
        hourCount: 0,
        bindings: [],
      };
      coaches.push(row);
      slugs.add(data.slug);
      return row;
    },
    async bind(coachId, provider, providerUserId) {
      const row = coaches.find((c) => c.id === coachId);
      if (!row) throw new Error("missing coach");
      if (!row.bindings.some((b) => b.provider === provider && b.providerUserId === providerUserId)) {
        row.bindings.push({ provider, providerUserId });
      }
    },
  };
  return store;
}

function readyCoach(over: Partial<Row> = {}): Row {
  return {
    id: "coach-1",
    email: "tim@example.com",
    banned: false,
    name: "Tim",
    title: "Tennis",
    timezone: "America/Toronto",
    subscriptionStatus: "active",
    service: { duration: 60, priceCad: 80 },
    locationCount: 1,
    hourCount: 5,
    bindings: [],
    ...over,
  };
}

async function main() {
async function run() {
  {
    const store = memoryStore();
    const out = await completeCoachOAuth(store, {
      provider: "google",
      providerUserId: "g-1",
      email: "new@example.com",
      name: "New Coach",
    });
    assert.equal(out.ok, true);
    if (out.ok) {
      assert.equal(out.created, true);
      assert.equal(out.setup, false);
      assert.equal(store.createdCount, 1);
      assert.equal(store.coaches[0].email, "new@example.com");
      assert.equal(store.coaches[0].subscriptionStatus, "none");
      assert.deepEqual(store.coaches[0].bindings, [{ provider: "google", providerUserId: "g-1" }]);
    }
  }

  {
    const store = memoryStore([readyCoach()]);
    const before = { ...store.coaches[0] };
    const out = await completeCoachOAuth(store, {
      provider: "facebook",
      providerUserId: "fb-9",
      email: "tim@example.com",
      name: "Other Name",
    });
    assert.equal(out.ok, true);
    if (out.ok) {
      assert.equal(out.created, false);
      assert.equal(out.coachId, "coach-1");
      assert.equal(out.setup, true);
      assert.equal(store.createdCount, 0);
      assert.equal(store.coaches.length, 1);
      assert.equal(store.coaches[0].subscriptionStatus, before.subscriptionStatus);
      assert.equal(store.coaches[0].locationCount, 1);
      assert.equal(store.coaches[0].hourCount, 5);
      assert.deepEqual(store.coaches[0].bindings, [{ provider: "facebook", providerUserId: "fb-9" }]);
    }
  }

  {
    const store = memoryStore();
    const out = await completeCoachOAuth(store, {
      provider: "google",
      providerUserId: "g-staff",
      email: "zhouxiyin1024@gmail.com",
      name: "Staff",
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.error, "This email is for the admin console. Use /admin.");
    assert.equal(store.createdCount, 0);
    assert.equal(store.coaches.length, 0);
  }

  {
    const store = memoryStore([readyCoach({ banned: true })]);
    const out = await completeCoachOAuth(store, {
      provider: "google",
      providerUserId: "g-ban",
      email: "tim@example.com",
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.error, "This account is disabled.");
    assert.equal(store.coaches[0].bindings.length, 0);
    assert.equal(store.createdCount, 0);
  }

  {
    const store = memoryStore([
      readyCoach({ bindings: [{ provider: "google", providerUserId: "g-ban" }], banned: true }),
    ]);
    const out = await completeCoachOAuth(store, {
      provider: "google",
      providerUserId: "g-ban",
      email: "tim@example.com",
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.error, "This account is disabled.");
  }

  {
    const store = memoryStore();
    const out = await completeCoachOAuth(store, {
      provider: "x",
      providerUserId: "x-no-mail",
      email: "",
      name: "No Mail",
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.error, "We need an email from X to continue.");
    assert.equal(store.createdCount, 0);
  }

  {
    const store = memoryStore();
    const google = await completeCoachOAuth(store, {
      provider: "google",
      providerUserId: "g-1",
      email: null,
    });
    assert.equal(google.ok, false);
    if (!google.ok) assert.equal(google.error, missingEmailCopy("google"));
  }

    console.log("oauth tests ok");
}

run();
}
void main();
