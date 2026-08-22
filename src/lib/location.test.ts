import assert from "node:assert/strict";
import { mustChooseLocation, pickLocation } from "./location";

const one = [{ id: "a" }];
const two = [{ id: "a" }, { id: "b" }];

assert.equal(mustChooseLocation(1), false);
assert.equal(mustChooseLocation(2), true);

assert.equal(pickLocation(one).ok, true);
assert.equal(pickLocation(one).ok && pickLocation(one).location.id, "a");
assert.equal(pickLocation(one, "ignored-if-only-one").ok, true);

const missing = pickLocation(two);
assert.equal(missing.ok, false);
assert.equal(!missing.ok && missing.error, "Choose a location");

const picked = pickLocation(two, "b");
assert.equal(picked.ok && picked.location.id, "b");

const bad = pickLocation(two, "z");
assert.equal(bad.ok, false);

assert.equal(pickLocation([]).ok, false);

console.log("location tests ok");
