import type Stripe from "stripe";
import { prisma } from "./db";

export async function syncCoachSubscription(sub: Stripe.Subscription, coachId?: string) {
  const id = coachId || (sub.metadata?.coachId as string | undefined);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const data = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId ?? undefined,
    subscriptionStatus: sub.status,
    trialEndsAt,
  };
  if (id) {
    await prisma.coach.update({ where: { id }, data });
    return;
  }
  if (sub.id) {
    const existing = await prisma.coach.findFirst({ where: { stripeSubscriptionId: sub.id } });
    if (existing) await prisma.coach.update({ where: { id: existing.id }, data });
  }
}
