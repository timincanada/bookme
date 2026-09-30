import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Store rules that are easy to undo by accident: coach subscriptions are sold on
 * the web only, so neither native app may show purchase UI (Apple 3.1.3, Google
 * Play Payments policy). Only the US App Store storefront may link out.
 */
const purchases = readFileSync(new URL("../native/purchases.ts", import.meta.url), "utf8");

// The only branch that turns purchases on is the web.
const enabling = [...purchases.matchAll(/showPurchases:\s*(true|false)/g)].map((m) => m[1]);
assert.equal(enabling.filter((v) => v === "true").length, 1, "exactly one place enables purchase UI");
const webBranch = purchases.slice(purchases.indexOf('platform === "web"'), purchases.indexOf("// Native"));
assert.match(webBranch, /showPurchases: true/, "purchases are enabled only for the web");
assert.doesNotMatch(purchases, /platform !== "ios"[\s\S]{0,120}showPurchases: true/, "Android must not enable purchases");

// The external account link stays limited to the US App Store storefront.
const external = purchases.slice(purchases.indexOf("showExternalAccountLink: country"));
assert.match(external, /country === "USA"/);
assert.match(purchases, /if \(platform !== "ios"\) return;/, "storefront check is iOS-only");

// Pages must gate their purchase UI on the policy, never on the platform directly.
for (const file of ["../../routes/app/billing.tsx", "../../routes/app/index.tsx", "../../components/bookme/assistant-presence.tsx"]) {
  const src = readFileSync(new URL(file, import.meta.url), "utf8");
  assert.match(src, /usePurchasePolicy\(\)/, `${file} reads the policy`);
  assert.match(src, /showPurchases/, `${file} gates on showPurchases`);
}

console.log("store-policy tests ok");
