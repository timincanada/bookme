import type Stripe from "stripe";
import { prisma } from "./db";
import { lastMonthRange, planForConfirmedCount, planFromPriceId, PLANS, priceIdForPlan } from "./subscription";
import { getStripe } from "./stripe";

export function planAmountCents(plan: keyof typeof PLANS) {
  return PLANS[plan].cad * 100;
}

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

export async function rewriteDraftInvoiceAmount(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  priceId: string,
  desiredCents: number,
) {
  if (invoice.status !== "draft" || !invoice.id) return invoice;
  const full = await stripe.invoices.retrieve(invoice.id, { expand: ["lines"] });
  if ((full.total ?? 0) === desiredCents) return full;
  const lines = full.lines?.data ?? [];
  if (lines.length) {
    await stripe.invoices.removeLines(full.id, {
      lines: lines.map((line) => ({ id: line.id, behavior: "delete" as const })),
    });
  }
  await stripe.invoices.addLines(full.id, {
    lines: [{ pricing: { price: priceId }, quantity: 1 }],
  });
  const updated = await stripe.invoices.retrieve(full.id);
  if ((updated.total ?? 0) !== desiredCents) {
    const delta = desiredCents - (updated.total ?? 0);
    if (delta !== 0) {
      await stripe.invoices.addLines(full.id, {
        lines: [{ amount: delta, description: "BookMe plan adjustment" }],
      });
    }
  }
  return stripe.invoices.retrieve(full.id);
}

export async function reconcilePlanForNextCycle(
  coachId: string,
  asOf = new Date(),
  invoice?: Stripe.Invoice,
) {
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
  const desiredCents = planAmountCents(desired);
  const invoiceTotal = invoice?.total ?? invoice?.amount_due ?? null;
  if (desired === coach.plan && invoiceTotal === desiredCents) return;

  const stripe = getStripe();
  const price = priceIdForPlan(desired);
  if (!stripe || !price) return;
  const sub = await stripe.subscriptions.retrieve(coach.stripeSubscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (itemId) {
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: itemId, price }],
      proration_behavior: "none",
    });
  }
  if (invoice?.status === "draft") {
    const updated = await rewriteDraftInvoiceAmount(stripe, invoice, price, desiredCents);
    if (updated.status === "draft") {
      await stripe.invoices.finalizeInvoice(updated.id);
    }
  }
  await prisma.coach.update({ where: { id: coachId }, data: { plan: desired } });
}
