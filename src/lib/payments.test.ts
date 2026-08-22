import assert from "node:assert/strict";
import { canUseMethod, enabledMethods, normalizeAccepted } from "./payments";

assert.deepEqual(enabledMethods(true, true), ["card", "cash"]);
assert.deepEqual(enabledMethods(true, false), ["card"]);
assert.deepEqual(enabledMethods(false, true), ["cash"]);
assert.equal(canUseMethod("card", false, true), false);
assert.equal(canUseMethod("cash", false, true), true);
assert.equal(normalizeAccepted(false, false), null);
assert.deepEqual(normalizeAccepted(true, false), { acceptCard: true, acceptCash: false });

console.log("payments tests ok");
