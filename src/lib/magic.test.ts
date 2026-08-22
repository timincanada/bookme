import assert from "node:assert/strict";
import { MAGIC_MS, isMagicOpen, magicExpiresAt, makeCode, makeToken, normalizeEmail } from "./magic";

assert.equal(makeCode().length, 6);
assert.match(makeCode(), /^\d{6}$/);
assert.equal(makeToken().length, 48);
assert.equal(normalizeEmail("  Emma@Test.COM "), "emma@test.com");

const now = new Date("2026-08-22T12:00:00Z");
const fresh = { expiresAt: magicExpiresAt(now), usedAt: null };
assert.equal(isMagicOpen(fresh, now), true);
assert.equal(isMagicOpen(fresh, new Date(now.getTime() + MAGIC_MS)), false);
assert.equal(isMagicOpen({ ...fresh, usedAt: now }, now), false);

console.log("magic tests ok");
