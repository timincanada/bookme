import assert from "node:assert/strict";
import { ADMIN_EMAIL, formatPlanLabel, isAdminEmail, paidSubscription, stripeFeeLabel } from "./admin";
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

assert.equal(stripeFeeLabel({ hasRecord: false }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 1900, currency: "cad" }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 2900, currency: "cad" }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: false, amountPaid: 4900, currency: "cad" }), "Stripe：无账单记录");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 1900, currency: "cad" }), "CA$19.00");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 2900, currency: "cad" }), "CA$29.00");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 0, currency: "cad" }), "CA$0.00");
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.light.cad.toFixed(2)}`);
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.coach.cad.toFixed(2)}`);
assert.notEqual(stripeFeeLabel({ hasRecord: false }), `CA$${PLANS.busy.cad.toFixed(2)}`);
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 1234, currency: "usd" }), "US$12.34");

console.log("admin tests ok");
