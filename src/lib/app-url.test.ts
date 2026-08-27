import assert from "node:assert/strict";
import { publicAppUrl } from "./app-url";

assert.equal(publicAppUrl().endsWith("/"), false);
assert.ok(publicAppUrl().startsWith("https://"));
if (!process.env.NEXT_PUBLIC_APP_URL) {
  assert.equal(publicAppUrl(), "https://bookme.training");
}
console.log("app-url tests ok");
