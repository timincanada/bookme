import assert from "node:assert/strict";
import {
  ADMIN_EMAIL,
  canPublish,
  conversionLabel,
  formatPlanLabel,
  formatStatusLabel,
  grantLabel,
  isAdminEmail,
  paidSubscription,
  stripeFeeLabel,
} from "./admin";
import { PLANS } from "./subscription";

assert.equal(ADMIN_EMAIL, "zhouxiyin1024@gmail.com");
assert.equal(isAdminEmail("zhouxiyin1024@gmail.com"), true);
assert.equal(isAdminEmail("ZhouXiyin1024@Gmail.com"), true);
assert.equal(isAdminEmail("  zhouxiyin1024@gmail.com  "), true);
assert.equal(isAdminEmail("coach@example.com"), false);
assert.equal(isAdminEmail(""), false);
assert.equal(isAdminEmail(null), false);

assert.equal(paidSubscription("trialing"), true);
assert.equal(paidSubscription("active"), true);
assert.equal(paidSubscription("none"), false);
assert.equal(paidSubscription("canceled"), false);
assert.equal(paidSubscription("past_due"), false);

assert.equal(formatPlanLabel("light"), "Light");
assert.equal(formatPlanLabel("coach"), "Coach");
assert.equal(formatPlanLabel("busy"), "Busy");
assert.equal(formatPlanLabel("none"), "—");

assert.equal(stripeFeeLabel({ hasRecord: false }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 1900, currency: "cad" }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 2900, currency: "cad" }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 4900, currency: "cad" }), "Stripe：无账单记录");
assert.ok(!stripeFeeLabel({ hasRecord: false }).includes("19"));
assert.ok(!stripeFeeLabel({ hasRecord: false }).includes("29"));
assert.ok(!stripeFeeLabel({ hasRecord: false }).includes("49"));
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 1900, currency: "cad" }), "CA$19.00");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 0, currency: "cad" }), "CA$0.00");
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.light.cad.toFixed(2)}`);
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.coach.cad.toFixed(2)}`);
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.busy.cad.toFixed(2)}`);

assert.equal(conversionLabel(2, 10), "20% (2 active / 10 registered)");
assert.equal(conversionLabel(0, 0), "0% (0 active / 0 registered)");
assert.equal(conversionLabel(0, 10), "0% (0 active / 10 registered)");
assert.equal(conversionLabel(1, 3), "33% (1 active / 3 registered)");

assert.equal(formatStatusLabel("past_due"), "active (Stripe: past_due)");
assert.equal(formatStatusLabel("active"), "active");
assert.equal(grantLabel("paid"), "Grant: paid");
assert.equal(grantLabel("unpaid"), "Grant: unpaid");
assert.equal(grantLabel(""), "Grant: none");

assert.equal(canPublish({ setup: true, status: "trialing" }), true);
assert.equal(canPublish({ setup: true, status: "none" }), false);
assert.equal(canPublish({ setup: true, status: "trialing", banned: true }), false);
assert.equal(canPublish({ setup: true, status: "none", banned: true, accessGrant: "paid" }), false);
assert.equal(canPublish({ setup: true, status: "trialing", accessGrant: "unpaid" }), false);
assert.equal(canPublish({ setup: true, status: "active", accessGrant: "unpaid", purpose: "accept" }), false);
assert.equal(canPublish({ setup: true, status: "none", accessGrant: "paid" }), true);
assert.equal(canPublish({ setup: false, status: "none", accessGrant: "paid" }), false);
assert.equal(canPublish({ setup: false, status: "none", accessGrant: "paid", purpose: "accept" }), true);
assert.equal(canPublish({ setup: false, status: "trialing", purpose: "accept" }), true);

console.log("admin tests ok");
