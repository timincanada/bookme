import assert from "node:assert/strict";
import {
  appleWalletSigningConfigured,
  buildCoachPass,
  signingConfigured,
} from "./apple-wallet/index.ts";

assert.equal(appleWalletSigningConfigured(), false);
assert.equal(signingConfigured(), false);

await assert.rejects(
  () =>
    buildCoachPass({
      id: "c1",
      slug: "alex",
      name: "Alex",
      title: "Tennis Coach",
      sport: "tennis",
      city: "Toronto",
      locations: [{ name: "Central Park Courts", address: "1 Park Ave", active: true }],
    }),
  /not configured/i,
);

console.log("apple-wallet tests ok");
