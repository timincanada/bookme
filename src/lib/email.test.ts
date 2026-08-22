import assert from "node:assert/strict";
import { looksLikeEmail, normalizeEmail } from "./email";

assert.equal(normalizeEmail("  Alex@Book.Me "), "alex@book.me");
assert.equal(looksLikeEmail("1111"), false);
assert.equal(looksLikeEmail(""), false);
assert.equal(looksLikeEmail("@x"), false);
assert.equal(looksLikeEmail("x@"), false);
assert.equal(looksLikeEmail("you@email.com"), true);
assert.equal(looksLikeEmail("  You@Email.com  "), true);

console.log("email tests ok");
