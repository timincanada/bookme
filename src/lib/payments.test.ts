import assert from "node:assert/strict";
import { canTakeCard, canUseMethod, enabledMethods, normalizeAccepted, platformFeeCents } from "./payments";

assert.equal(platformFeeCents(80), 400);
assert.equal(platformFeeCents(19), 95);
assert.equal(canTakeCard(true, null), false);
assert.equal(canTakeCard(true, "acct_1"), true);
assert.equal(canTakeCard(false, "acct_1"), false);
assert.deepEqual(enabledMethods(true, true, "acct_1"), ["card", "cash"]);
assert.deepEqual(enabledMethods(true, true, null), ["cash"]);
assert.deepEqual(enabledMethods(true, false, null), []);
assert.deepEqual(enabledMethods(false, true), ["cash"]);
assert.equal(canUseMethod("card", true, true, null), false);
assert.equal(canUseMethod("card", true, true, "acct_1"), true);
assert.equal(canUseMethod("cash", false, true), true);
assert.equal(normalizeAccepted(false, false), null);
assert.deepEqual(normalizeAccepted(true, false), { acceptCard: true, acceptCash: false });

console.log("payments tests ok");
