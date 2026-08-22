import assert from "node:assert/strict";
import {
  canAcceptNewBookings,
  lastMonthRange,
  planForConfirmedCount,
  PLANS,
  hasCapability,
  planCapabilities,
  shouldPriceInvoiceFromLastMonth,
  TRIAL_DAYS,
} from "./subscription";

assert.equal(TRIAL_DAYS, 3);
assert.equal(PLANS.light.cad, 19);
assert.equal(PLANS.coach.cad, 29);
assert.equal(PLANS.busy.cad, 49);
assert.equal(planForConfirmedCount(20), "light");
assert.equal(planForConfirmedCount(21), "coach");
assert.equal(planForConfirmedCount(61), "busy");
assert.equal(PLANS.busy.cad * 100, 4900);
assert.equal(canAcceptNewBookings("trialing"), true);
assert.equal(canAcceptNewBookings("canceled"), false);
const sept = new Date("2026-09-01T00:00:00Z");
const { start, end } = lastMonthRange(sept);
assert.equal(start.toISOString(), "2026-08-01T00:00:00.000Z");
assert.equal(end.toISOString(), "2026-09-01T00:00:00.000Z");
assert.equal(planForConfirmedCount(61), "busy");

assert.equal(
  shouldPriceInvoiceFromLastMonth({
    billingReason: "subscription_cycle",
    invoiceStatus: "draft",
    subscriptionStatus: "active",
    trialEnd: new Date("2026-08-04T00:00:00Z"),
    periodStart: sept,
  }),
  true,
);
assert.equal(
  shouldPriceInvoiceFromLastMonth({
    billingReason: "subscription_cycle",
    invoiceStatus: "draft",
    subscriptionStatus: "trialing",
    periodStart: sept,
  }),
  false,
);
assert.equal(
  shouldPriceInvoiceFromLastMonth({
    billingReason: "subscription_cycle",
    invoiceStatus: "paid",
    subscriptionStatus: "active",
    periodStart: sept,
  }),
  false,
);
assert.equal(
  shouldPriceInvoiceFromLastMonth({
    billingReason: "subscription_cycle",
    invoiceStatus: "draft",
    subscriptionStatus: "active",
    trialEnd: new Date("2026-08-04T00:00:00Z"),
    periodStart: new Date("2026-08-04T00:00:00Z"),
  }),
  false,
);

assert.deepEqual(planCapabilities("light"), []);
assert.equal(hasCapability("light", "list_availability"), false);
assert.equal(hasCapability("coach", "message_student"), true);
assert.equal(hasCapability("busy", "mutate_schedule"), true);

console.log("subscription tests ok");
