import assert from "node:assert/strict";
import {
  ADMIN_EMAIL,
  NO_ACCESS_COPY,
  appAdminView,
  canPublish,
  coachStats,
  conversionLabel,
  formatPlanLabel,
  grantLabel,
  isAdminEmail,
  isStaffEmail,
  paidSubscription,
  planAfterPaidGrant,
  staffAdminView,
  staffAuthStatus,
  stripeFeeLabel,
  visibleCoaches,
} from "./admin";
import { SESSION_COOKIE, STAFF_COOKIE } from "./auth";
import { canCopyBookingLink } from "./setup";
import { PLANS } from "./subscription";

assert.equal(ADMIN_EMAIL, "zhouxiyin1024@gmail.com");
assert.equal(NO_ACCESS_COPY, "You don't have access");
assert.equal(isAdminEmail("zhouxiyin1024@gmail.com"), true);
assert.equal(isAdminEmail("ZhouXiyin1024@Gmail.com"), true);
assert.equal(isAdminEmail("  zhouxiyin1024@gmail.com  "), true);
assert.equal(isAdminEmail("coach@example.com"), false);
assert.equal(isAdminEmail(""), false);
assert.equal(isAdminEmail(null), false);

assert.equal(isStaffEmail("zhouxiyin1024@gmail.com"), true);
assert.equal(isStaffEmail("  ZhouXiyin1024@Gmail.com  "), true);
assert.equal(isStaffEmail("coach@example.com"), false);
assert.equal(isStaffEmail(""), false);
assert.equal(isStaffEmail(null), false);
assert.equal(isStaffEmail("other@x.com", ["other@x.com"]), true);
assert.equal(isStaffEmail("coach@example.com", ["zhouxiyin1024@gmail.com"]), false);

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
assert.equal(
  visibleCoaches(coaches, staffEmails).some((c) => isAdminEmail(c.email)),
  false,
);

const stats = coachStats(coaches, staffEmails);
assert.equal(stats.registeredCoaches, 3);
assert.equal(stats.onTrial, 1);
assert.equal(stats.subscribed, 1);
assert.equal(stats.conversionLabel, conversionLabel(1, 3));
assert.equal(coachStats([], staffEmails).registeredCoaches, 0);
assert.equal(coachStats([], staffEmails).conversionLabel, "—");

assert.equal(staffAuthStatus(null, true), 401);
assert.equal(staffAuthStatus("", false), 401);
assert.equal(staffAuthStatus("staff-id", false), 403);
assert.equal(staffAuthStatus("staff-id", true), 200);
assert.equal(staffAuthStatus(null, isAdminEmail("zhouxiyin1024@gmail.com")), 401);

assert.equal(STAFF_COOKIE, "bookme_staff");
assert.equal(SESSION_COOKIE, "bookme_coach");
assert.notEqual(STAFF_COOKIE, SESSION_COOKIE);
assert.equal(staffAdminView(true, false), "403");
assert.equal(staffAdminView(true, true), "403");
assert.equal(staffAdminView(false, false), "login");
assert.equal(staffAdminView(false, true), "list");
assert.equal(appAdminView(), "403");

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
