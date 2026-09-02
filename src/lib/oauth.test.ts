import assert from "node:assert/strict";
import {
  OAUTH_DISABLED,
  OAUTH_NO_EMAIL,
  OAUTH_STAFF,
  PROVIDERS,
  isOAuthProvider,
  oauthMissingEmailCopy,
  oauthRedirectUri,
  providerConfigured,
  providerLabel,
  readOAuthState,
  resolveCoachFromOAuth,
  signOAuthState,
  type CoachOAuthRecord,
  type OAuthStore,
} from "./oauth";

assert.deepEqual([...PROVIDERS], ["google", "facebook", "x", "instagram"]);
assert.equal(isOAuthProvider("google"), true);
assert.equal(isOAuthProvider("instagram"), true);
assert.equal(isOAuthProvider("apple"), false);
assert.equal(providerLabel("instagram"), "Instagram");
assert.equal(OAUTH_NO_EMAIL, "That account did not share an email");
assert.equal(OAUTH_DISABLED, "This account is disabled.");
assert.equal(OAUTH_STAFF, "This email is for the admin console. Use /admin.");
assert.equal(oauthMissingEmailCopy("instagram"), "We need an email from Instagram to continue.");

const prevUrl = process.env.NEXT_PUBLIC_APP_URL;
delete process.env.NEXT_PUBLIC_APP_URL;
assert.equal(oauthRedirectUri("google", "http://localhost:3000"), "http://localhost:3000/api/auth/oauth/google/callback");
process.env.NEXT_PUBLIC_APP_URL = "https://bookme.training/";
assert.equal(oauthRedirectUri("x", "http://localhost:3000"), "https://bookme.training/api/auth/oauth/x/callback");
if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
else process.env.NEXT_PUBLIC_APP_URL = prevUrl;

const prevId = process.env.GOOGLE_CLIENT_ID;
const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
assert.equal(providerConfigured("google"), false);
process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "secret";
assert.equal(providerConfigured("google"), true);
if (prevId === undefined) delete process.env.GOOGLE_CLIENT_ID;
else process.env.GOOGLE_CLIENT_ID = prevId;
if (prevSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
else process.env.GOOGLE_CLIENT_SECRET = prevSecret;

const prevIgId = process.env.INSTAGRAM_CLIENT_ID;
const prevIgSecret = process.env.INSTAGRAM_CLIENT_SECRET;
delete process.env.INSTAGRAM_CLIENT_ID;
delete process.env.INSTAGRAM_CLIENT_SECRET;
assert.equal(providerConfigured("instagram"), false);
process.env.INSTAGRAM_CLIENT_ID = "id";
process.env.INSTAGRAM_CLIENT_SECRET = "secret";
assert.equal(providerConfigured("instagram"), true);
if (prevIgId === undefined) delete process.env.INSTAGRAM_CLIENT_ID;
else process.env.INSTAGRAM_CLIENT_ID = prevIgId;
if (prevIgSecret === undefined) delete process.env.INSTAGRAM_CLIENT_SECRET;
else process.env.INSTAGRAM_CLIENT_SECRET = prevIgSecret;

const signed = signOAuthState({ provider: "facebook", from: "register", nonce: "n1", verifier: "v1" });
assert.equal(readOAuthState(signed)?.provider, "facebook");
assert.equal(readOAuthState("bad.token"), null);

type Account = { coachId: string; provider: string; providerUserId: string };

function memoryStore(seedCoaches: CoachOAuthRecord[] = [], seedAccounts: Account[] = []) {
  const coaches = seedCoaches.map((c) => ({ ...c }));
  const accounts = seedAccounts.map((a) => ({ ...a }));
  const store: OAuthStore & { coaches: CoachOAuthRecord[]; accounts: Account[] } = {
    coaches,
    accounts,
    async findAccount(provider, providerUserId) {
      return accounts.find((a) => a.provider === provider && a.providerUserId === providerUserId) || null;
    },
    async findCoachById(id) {
      return coaches.find((c) => c.id === id) || null;
    },
    async findCoachByEmail(email) {
      return coaches.find((c) => c.email === email) || null;
    },
    async findCoachBySlug(slug) {
      return coaches.find((c) => c.slug === slug) || null;
    },
    async createCoach(data) {
      const row: CoachOAuthRecord = {
        id: `c${coaches.length + 1}`,
        email: data.email,
        name: data.name,
        banned: false,
        passwordHash: data.passwordHash,
        slug: data.slug,
        title: data.title,
        city: data.city,
        timezone: data.timezone,
      };
      coaches.push(row);
      return row;
    },
    async createAccount(data) {
      accounts.push({ ...data });
    },
  };
  return store;
}

function coach(over: Partial<CoachOAuthRecord> = {}): CoachOAuthRecord {
  return {
    id: "coach-1",
    email: "tim@example.com",
    name: "Tim",
    banned: false,
    passwordHash: "salt:hash",
    slug: "tim",
    title: "Tennis",
    city: "Markham",
    timezone: "America/Toronto",
    ...over,
  };
}

async function run() {
  const created = await resolveCoachFromOAuth(
    { provider: "google", providerUserId: "g-1", email: "New@Example.com", name: "New Coach" },
    memoryStore(),
  );
  assert.equal(created.email, "new@example.com");
  assert.equal(created.passwordHash, null);
  assert.equal(created.name, "New Coach");

  const named = await resolveCoachFromOAuth(
    { provider: "facebook", providerUserId: "fb-1", email: "anon@example.com", name: "  " },
    memoryStore(),
  );
  assert.equal(named.name, "Coach");

  const linkStore = memoryStore([coach()]);
  const linked = await resolveCoachFromOAuth(
    { provider: "facebook", providerUserId: "fb-9", email: "Tim@Example.com", name: "Other" },
    linkStore,
  );
  assert.equal(linked.id, "coach-1");
  assert.equal(linkStore.accounts.length, 1);

  const existStore = memoryStore([coach()], [{ coachId: "coach-1", provider: "google", providerUserId: "g-1" }]);
  const exist = await resolveCoachFromOAuth(
    { provider: "google", providerUserId: "g-1", email: "other@example.com", name: "Nope" },
    existStore,
  );
  assert.equal(exist.id, "coach-1");
  assert.equal(existStore.coaches.length, 1);

  await assert.rejects(
    () => resolveCoachFromOAuth({ provider: "google", providerUserId: "g-ban", email: "tim@example.com" }, memoryStore([coach({ banned: true })])),
    (err: Error) => err.message === OAUTH_DISABLED,
  );
  await assert.rejects(
    () => resolveCoachFromOAuth({ provider: "x", providerUserId: "x-1", email: "tim@example.com" }, memoryStore([coach({ banned: true })], [{ coachId: "coach-1", provider: "x", providerUserId: "x-1" }])),
    (err: Error) => err.message === OAUTH_DISABLED,
  );
  await assert.rejects(
    () => resolveCoachFromOAuth({ provider: "x", providerUserId: "x-no", email: "", name: "No Mail" }, memoryStore()),
    (err: Error) => err.message === OAUTH_NO_EMAIL,
  );
  const noEmailExisting = await resolveCoachFromOAuth(
    { provider: "google", providerUserId: "g-1", email: null },
    memoryStore([coach()], [{ coachId: "coach-1", provider: "google", providerUserId: "g-1" }]),
  );
  assert.equal(noEmailExisting.id, "coach-1");
  await assert.rejects(
    () => resolveCoachFromOAuth({ provider: "instagram", providerUserId: "ig-1", email: null, name: "ig" }, memoryStore()),
    (err: Error) => err.message === OAUTH_NO_EMAIL,
  );
  await assert.rejects(
    () => resolveCoachFromOAuth({ provider: "google", providerUserId: "g-staff", email: "zhouxiyin1024@gmail.com" }, memoryStore()),
    (err: Error) => err.message === OAUTH_STAFF,
  );
  console.log("oauth tests ok");
}

run();
