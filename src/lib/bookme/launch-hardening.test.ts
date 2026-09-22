import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { isVerifiedAdmin, ADMIN_EMAIL } from "./admin.ts";
import { guardInput, InvalidInputError } from "./input-guard.ts";

// ---- input guard -----------------------------------------------------------
assert.deepEqual(guardInput({ a: "x", b: 1, c: [true, null], d: { e: "f" } }), { a: "x", b: 1, c: [true, null], d: { e: "f" } });
assert.equal(guardInput(undefined), undefined);
assert.throws(() => guardInput("str" as unknown as object), InvalidInputError);
assert.throws(() => guardInput([1] as unknown as object), InvalidInputError);
assert.throws(() => guardInput({ n: Number.NaN }), /finite/);
assert.throws(() => guardInput({ n: Infinity }), /finite/);
assert.throws(() => guardInput({ s: "x".repeat(20_001) }), /too long/);
assert.throws(() => guardInput({ a: Array.from({ length: 501 }, () => 1) }), /too many items/);
assert.throws(() => guardInput(JSON.parse('{"__proto__": {"admin": true}}')), /not allowed/);
assert.throws(() => guardInput({ constructor: 1 }), /not allowed/);
assert.throws(() => guardInput({ d: new Date() }), /plain object/);
assert.throws(() => guardInput({ f: (() => 1) as unknown as string }), /unsupported/);
let deep: Record<string, unknown> = {};
const root = deep;
for (let i = 0; i < 8; i++) { deep.x = {}; deep = deep.x as Record<string, unknown>; }
assert.throws(() => guardInput(root), /nested/);

// ---- admin needs a verified email -------------------------------------------
assert.equal(isVerifiedAdmin({ email: ADMIN_EMAIL, emailVerified: false }), false, "claimed but unverified");
assert.equal(isVerifiedAdmin({ email: ADMIN_EMAIL.toUpperCase(), emailVerified: true }), true);
assert.equal(isVerifiedAdmin({ email: "someone@else.test", emailVerified: true }), false);
assert.equal(isVerifiedAdmin(null), false);

// ---- 0010: demo coaches removed unless claimed / used ------------------------
const dir = new URL("../../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
assert.equal(files.at(-1), "0010_launch_hardening.sql");
const pg = new PGlite();
await pg.waitReady;
for (const f of files.filter((f) => f < "0010")) await pg.transaction(async (tx) => { await tx.exec(readFileSync(new URL(f, dir), "utf8")); });
// Daniel was claimed by a real account; Maya has real activity; the rest are untouched demo rows.
await pg.exec(`
  update coaches set user_id = 'u-real' where id = 'coach-daniel-kim';
  insert into clients (id, coach_id, name, email) values ('c1', 'coach-maya-shah', 'Real', 'r@x.test');
`);
await pg.transaction(async (tx) => { await tx.exec(readFileSync(new URL("0010_launch_hardening.sql", dir), "utf8")); });
const left = (await pg.query<{ id: string }>(`select id from coaches order by id`)).rows.map((r) => r.id);
assert.deepEqual(left, ["coach-daniel-kim", "coach-maya-shah"]);
assert.equal((await pg.query(`select 1 from services where coach_id = 'coach-tim-zhang'`)).rows.length, 0, "children cascade");
assert.equal((await pg.query(`select 1 from weekly_hours where coach_id = 'coach-tim-zhang'`)).rows.length, 0);
await pg.query(`insert into "rateLimit" (id, key, count, "lastRequest") values ('r', '1.1.1.1/sign-in/email', 1, 1)`);
// Dev seed restores demo coaches without clobbering existing ones.
await pg.exec(`delete from clients; delete from coaches where id in ('coach-daniel-kim','coach-maya-shah')`);
await pg.exec(readFileSync(new URL("dev/seed.sql", dir), "utf8"));
assert.equal((await pg.query(`select 1 from coaches where id like 'coach-%'`)).rows.length, 6);
await pg.close();

// ---- production 0002→0010 leaves no demo coach -------------------------------
const fresh = new PGlite();
await fresh.waitReady;
for (const f of files) await fresh.transaction(async (tx) => { await tx.exec(readFileSync(new URL(f, dir), "utf8")); });
assert.equal((await fresh.query(`select 1 from coaches`)).rows.length, 0, "fresh production database has no demo coaches");
await fresh.close();

// ---- source-level guarantees ------------------------------------------------
const api = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("./stripe-webhook.ts", import.meta.url), "utf8");
const cron = readFileSync(new URL("../../routes/api/cron/reminders.ts", import.meta.url), "utf8");
for (const src of [api, webhook]) {
  for (const call of src.match(/stripe\.refunds\.create\(\{[\s\S]*?\}\)/g) ?? []) {
    assert.match(call, /reverse_transfer: true/, "every refund reverses the Connect transfer");
    assert.match(call, /refund_application_fee: (true|false)/, "every refund states who bears the fee");
  }
}
assert.equal((api.match(/stripe\.refunds\.create/g) ?? []).length, 2);
assert.match(api, /Date\.now\(\) \+ 31 \* 60 \* 1000/, "Checkout expiry ≥ 30 min");
assert.match(cron, /if \(!secret\) return false/, "cron closed without a secret");
assert.doesNotMatch(api, /=> input\)/, "no unguarded validators");
assert.match(api, /export const placesAutocomplete = createServerFn\(\{ method: "GET" \}\)\n\s+\.middleware\(\[authMiddleware\]\)/);
assert.match(api, /export const placesDetails = createServerFn\(\{ method: "GET" \}\)\n\s+\.middleware\(\[authMiddleware\]\)/);

console.log("launch-hardening tests ok");

// ---- CSP -------------------------------------------------------------------
{
  const { buildCsp } = await import("../csp.ts");
  const csp = buildCsp("abc123");
  assert.match(csp, /script-src 'self' 'nonce-abc123'(;|$)/);
  assert.doesNotMatch(csp.match(/script-src[^;]*/)![0], /unsafe-inline|unsafe-eval|\*/, "no unsafe script sources");
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /base-uri 'self'/);
  assert.doesNotMatch(csp, /grok\.com/);
  const shared = await import("../../../scripts/grok-pwa-shared.mjs");
  delete process.env.GROK_EXTENSIONS_ENABLED;
  assert.deepEqual(shared.grokExtensionsHeadTags("p1"), [], "grok.com script not injected by default");
  console.log("csp tests ok");
}
