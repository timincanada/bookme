import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { PREVIEW_ALLOWED_HOSTS } from "./preview.ts";
import { trustedAuthOrigins } from "./trusted-origins.ts";

const require = createRequire(import.meta.url);
const entry = require.resolve("better-auth");
const { matchesOriginPattern } = (await import(
  pathToFileURL(join(dirname(entry), "auth/trusted-origins.mjs")).href
)) as { matchesOriginPattern: (url: string, pattern: string) => boolean };

const RILEY =
  "https://bookme-git-feat-venue-weather-v1-zhouxiyin1024-9117s-projects.vercel.app";
const DEPLOYMENT = "bookme-abc123-zhouxiyin1024-9117s-projects.vercel.app";
const BRANCH = "bookme-git-feat-venue-weather-v1-zhouxiyin1024-9117s-projects.vercel.app";

function accepts(origins: string[], url: string) {
  return origins.some((origin) => matchesOriginPattern(url, origin));
}

describe("trustedAuthOrigins", () => {
  it("keeps bookme.training and the live deployment host on production", () => {
    const origins = trustedAuthOrigins(
      {
        BETTER_AUTH_URL: "https://bookme.training",
        BOOKME_APP_URL: "https://bookme.training",
        VERCEL_URL: DEPLOYMENT,
        VERCEL_BRANCH_URL: "bookme-git-main-zhouxiyin1024-9117s-projects.vercel.app",
        VERCEL_ENV: "production",
      },
      PREVIEW_ALLOWED_HOSTS,
    );
    assert.equal(accepts(origins, "https://bookme.training"), true);
    assert.equal(accepts(origins, "https://www.bookme.training"), true);
    assert.equal(accepts(origins, `https://${DEPLOYMENT}`), true);
    assert.equal(accepts(origins, RILEY), false);
    assert.equal(accepts(origins, "https://evil.vercel.app"), false);
    assert.equal(origins.includes("https://*.vercel.app"), false);
  });

  it("trusts the PR preview host when BETTER_AUTH_URL still points at production", () => {
    const origins = trustedAuthOrigins(
      {
        BETTER_AUTH_URL: "https://bookme.training",
        BOOKME_APP_URL: "https://bookme.training",
        VERCEL_URL: DEPLOYMENT,
        VERCEL_BRANCH_URL: BRANCH,
        VERCEL_ENV: "preview",
      },
      PREVIEW_ALLOWED_HOSTS,
    );
    assert.equal(accepts(origins, "https://bookme.training"), true);
    assert.equal(accepts(origins, "https://www.bookme.training"), true);
    assert.equal(accepts(origins, `https://${DEPLOYMENT}`), true);
    assert.equal(accepts(origins, `http://${DEPLOYMENT}`), true);
    assert.equal(accepts(origins, RILEY), true);
    assert.equal(accepts(origins, "https://bookme-other-alias.vercel.app"), true);
    assert.equal(origins.includes("*.vercel.app"), true);
    assert.equal(origins.includes("https://*.vercel.app"), true);
  });

  it("still trusts sandbox preview hosts when no public URL is configured", () => {
    const origins = trustedAuthOrigins({}, PREVIEW_ALLOWED_HOSTS);
    assert.equal(accepts(origins, "https://abc.grok-sandbox.com"), true);
    assert.equal(accepts(origins, "http://localhost:8080"), true);
    assert.equal(accepts(origins, "https://bookme.training"), true);
    assert.equal(origins.includes("*.grok-sandbox.com"), true);
  });
});
