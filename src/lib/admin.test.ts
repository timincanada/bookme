import assert from "node:assert/strict";
import {
  ADMIN_EMAIL,
  canPublish,
  conversionLabel,
  formatPlanLabel,
  grantLabel,
  isAdminEmail,
  paidSubscription,
  planAfterPaidGrant,
  stripeFeeLabel,
} from "./admin";
import { canCopyBookingLink } from "./setup";
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
assert.equal(paidSubscription("trialing", new Date("2026-08-25T00:00:00Z"), new Date("2026-08-27T12:00:00Z")), true);
assert.equal(paidSubscription("trialing", new Date("2026-08-30T00:00:00Z"), new Date("2026-08-27T12:00:00Z")), true);

assert.equal(formatPlanLabel("light"), "Light");
assert.equal(formatPlanLabel("coach"), "Coach");
assert.equal(formatPlanLabel("busy"), "Busy");
assert.equal(formatPlanLabel("none"), "—");
assert.equal(formatPlanLabel(""), "—");
assert.equal(formatPlanLabel(null), "—");
assert.equal(formatPlanLabel("other"), "—");

assert.equal(stripeFeeLabel({ hasRecord: false }), "No Stripe record");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 1900, currency: "cad" }), "No Stripe record");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 2900, currency: "cad" }), "No Stripe record");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 4900, currency: "cad" }), "No Stripe record");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 1900, currency: "cad" }), "CA$19.00");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 2900, currency: "cad" }), "CA$29.00");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 0, currency: "cad" }), "CA$0.00");
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.light.cad.toFixed(2)}`);
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.coach.cad.toFixed(2)}`);
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.busy.cad.toFixed(2)}`);
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 1234, currency: "usd" }), "US$12.34");

assert.equal(conversionLabel(2, 10), "20% (2 active ÷ 10 registered coaches)");
assert.equal(conversionLabel(0, 0), "—");
assert.equal(conversionLabel(0, 10), "0% (0 active ÷ 10 registered coaches)");
assert.equal(conversionLabel(1, 3), "33% (1 active ÷ 3 registered coaches)");

assert.equal(grantLabel(""), "Grant: none");
assert.equal(grantLabel(null), "Grant: none");
assert.equal(grantLabel("paid"), "Grant: paid");
assert.equal(grantLabel("unpaid"), "Grant: unpaid");
assert.equal(planAfterPaidGrant("none"), "light");
assert.equal(planAfterPaidGrant("light"), "light");
assert.equal(planAfterPaidGrant("coach"), "coach");
assert.equal(planAfterPaidGrant("busy"), "busy");

assert.equal(canCopyBookingLink(true, "none", null, false, "paid"), true);
assert.equal(canPublish({ setup: true, status: "none", accessGrant: "paid" }), true);
assert.equal(canCopyBookingLink(true, "trialing", null, false, "unpaid"), false);
assert.equal(canCopyBookingLink(true, "active", null, false, "unpaid"), false);
assert.equal(canCopyBookingLink(true, "none", null, true, "paid"), false);
assert.equal(canCopyBookingLink(true, "active", null, true, "paid"), false);
assert.equal(canCopyBookingLink(false, "none", null, false, "paid"), false);

console.log("admin tests ok");
