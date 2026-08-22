import type Stripe from "stripe";
import { prisma } from "./db";
import { lastMonthRange, planForConfirmedCount, planFromPriceId, priceIdForPlan } from "./subscription";
import { getStripe } from "./stripe";

export async function syncCoachSubscription(sub: Stripe.Subscription, coachId?: string) {
  const id = coachId || (sub.metadata?.coachId as string | undefined);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const priceId = sub.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId) || "light";
  const data = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId ?? undefined,
    subscriptionStatus: sub.status,
    trialEndsAt,
    plan: sub.status === "trialing" || sub.status === "active" ? plan : "none",
  };
  if (id) {
    await prisma.coach.update({ where: { id }, data });
    return;
  }
  const existing = await prisma.coach.findFirst({ where: { stripeSubscriptionId: sub.id } });
  if (existing) await prisma.coach.update({ where: { id: existing.id }, data });
}

export async function reconcilePlanForNextCycle(coachId: string, asOf = new Date()) {
  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach?.stripeSubscriptionId || !["trialing", "active"].includes(coach.subscriptionStatus)) return;
  const { start, end } = lastMonthRange(asOf);
  const count = await prisma.lesson.count({
    where: {
      coachId,
      status: "confirmed",
      startAt: { gte: start, lt: end },
    },
  });
  const desired = planForConfirmedCount(count);
  if (desired === coach.plan) return;
  const stripe = getStripe();
  const price = priceIdForPlan(desired);
  if (!stripe || !price) return;
  const sub = await stripe.subscriptions.retrieve(coach.stripeSubscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) return;
  await stripe.subscriptions.update(sub.id, {
    items: [{ id: itemId, price }],
    proration_behavior: "none",
  });
  await prisma.coach.update({ where: { id: coachId }, data: { plan: desired } });
}
