import assert from "node:assert/strict";
import { publicAppUrl } from "./app-url.ts";

assert.equal(publicAppUrl().endsWith("/"), false);
assert.ok(publicAppUrl().startsWith("https://"));
if (
  !process.env.NEXT_PUBLIC_APP_URL &&
  !process.env.BOOKME_APP_URL &&
  !process.env.VITE_APP_URL &&
  !process.env.VERCEL_URL
) {
  assert.equal(publicAppUrl(), "https://bookme.training");
}

const previewHost = "bookme-git-feat-venue-weather-v1-example.vercel.app";
assert.equal(
  publicAppUrl({
    BOOKME_APP_URL: "https://bookme.training",
    VERCEL_ENV: "preview",
    VERCEL_URL: previewHost,
  }),
  `https://${previewHost}`,
);
assert.equal(
  publicAppUrl({
    BOOKME_APP_URL: "https://bookme.training",
    VERCEL_ENV: "Preview",
    VERCEL_BRANCH_URL: previewHost,
  }),
  `https://${previewHost}`,
);
assert.equal(
  publicAppUrl({
    BOOKME_APP_URL: "https://bookme.training/",
    VERCEL_ENV: "production",
    VERCEL_URL: "bookme-abc.vercel.app",
  }),
  "https://bookme.training",
);
assert.equal(
  publicAppUrl({
    VERCEL_ENV: "preview",
    VERCEL_URL: `https://${previewHost}/`,
    BOOKME_APP_URL: "https://bookme.training",
  }),
  `https://${previewHost}`,
);

console.log("app-url tests ok");
