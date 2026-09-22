import assert from "node:assert/strict";
import {
  ADMIN_EMAIL,
  NO_ACCESS_COPY,
  appAdminView,
  canPublish,
  coachStats,
  conversionLabel,
  formatPlanLabel,
  formatStatusLabel,
  grantLabel,
  isAdminEmail,
  isStaffEmail,
  paidSubscription,
  planAfterPaidGrant,
  staffAdminView,
  staffAuthStatus,
  stripeFeeLabel,
  visibleCoaches,
} from "./admin.ts";

assert.equal(ADMIN_EMAIL, "zhouxiyin1024@gmail.com");
assert.equal(NO_ACCESS_COPY, "You don't have access");
assert.equal(isAdminEmail("zhouxiyin1024@gmail.com"), true);
assert.equal(isAdminEmail("ZhouXiyin1024@Gmail.com"), true);
assert.equal(isAdminEmail("coach@example.com"), false);

assert.equal(isStaffEmail("zhouxiyin1024@gmail.com"), true);
assert.equal(isStaffEmail("coach@example.com"), false);
assert.equal(isStaffEmail("other@x.com", ["other@x.com"]), true);

const coaches = [
  { email: "zhouxiyin1024@gmail.com", banned: false, subscriptionStatus: "active" },
  { email: "a@test.com", banned: false, subscriptionStatus: "trialing" },
  { email: "b@test.com", banned: true, subscriptionStatus: "active" },
  { email: "c@test.com", banned: false, subscriptionStatus: "active" },
];
const staffEmails = ["zhouxiyin1024@gmail.com"];
const visible = visibleCoaches(coaches, staffEmails);
assert.equal(visible.length, 3);
assert.equal(visible.some((c) => isStaffEmail(c.email, staffEmails)), false);

const stats = coachStats(coaches, staffEmails, new Date("2026-09-01T00:00:00Z"));
assert.equal(stats.registeredCoaches, 3);
assert.equal(stats.onTrial, 1);
assert.equal(stats.subscribed, 1);
assert.equal(conversionLabel(1, 3), "33% (1 active ÷ 3 registered coaches)");
assert.equal(conversionLabel(0, 0), "—");

assert.equal(paidSubscription("trialing"), true);
assert.equal(paidSubscription("active"), true);
assert.equal(paidSubscription("none"), false);
assert.equal(grantLabel("paid"), "Grant: paid");
assert.equal(planAfterPaidGrant("none"), "light");
assert.equal(formatPlanLabel("coach"), "Coach");
assert.equal(staffAuthStatus(null, false), 401);
assert.equal(staffAuthStatus("id", false), 403);
assert.equal(staffAuthStatus("id", true), 200);
assert.equal(staffAdminView(true, false), "403");
assert.equal(staffAdminView(false, true), "list");
assert.equal(staffAdminView(false, false), "login");
assert.equal(appAdminView(), "403");
assert.equal(stripeFeeLabel({ hasRecord: false }), "No Stripe record");
assert.equal(stripeFeeLabel({ hasRecord: true, amountPaid: 1900, currency: "cad" }), "CA$19.00");
assert.equal(formatStatusLabel("active", null, "past_due"), "active (Stripe: past_due)");
assert.equal(canPublish({ setup: true, status: "active" }), true);
assert.equal(canPublish({ setup: true, status: "none", accessGrant: "paid" }), true);
assert.equal(canPublish({ setup: true, status: "active", banned: true }), false);

console.log("admin tests ok");
