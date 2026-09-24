import assert from "node:assert/strict";
import { demoAllowed } from "./demo.ts";

assert.equal(demoAllowed({ NODE_ENV: "development" }), true);
assert.equal(demoAllowed({ NODE_ENV: "test" }), true);
assert.equal(demoAllowed({ NODE_ENV: "production" }), false);
assert.equal(demoAllowed({ NODE_ENV: "production", VERCEL_ENV: "production" }), false);
assert.equal(demoAllowed({ NODE_ENV: "production", BOOKME_ALLOW_DEMO: "1" }), true);
assert.equal(demoAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
assert.equal(demoAllowed({ NODE_ENV: "production", VERCEL_ENV: "Preview" }), true);
