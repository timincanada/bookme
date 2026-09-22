import type Stripe from "stripe";
import type { Sql } from "@/lib/db";
import { getStripe } from "./stripe";
import {
  lastMonthRange,
  planForConfirmedCount,
  planFromPriceId,
  PLANS,
  priceIdForPlan,
  isTrialing,
  type PlanId,
} from "./subscription";

export function planAmountCents(plan: keyof typeof PLANS) {
  return PLANS[plan].cad * 100;
}

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function syncCoachSubscription(sql: Sql, sub: Stripe.Subscription, coachId?: string) {
  const id = coachId || (sub.metadata?.coachId as string | undefined);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const priceId = sub.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId) || "light";
  const storedPlan = sub.status === "trialing" || sub.status === "active" ? plan : "none";
  if (id) {
    await sql.query(
      `update coaches set stripe_subscription_id = $1, stripe_customer_id = coalesce($2, stripe_customer_id),
         subscription_status = $3, trial_ends_at = $4, plan = $5
       where id = $6`,
      [sub.id, customerId ?? null, sub.status, trialEndsAt?.toISOString() ?? null, storedPlan, id],
    );
    return;
  }
  await sql.query(
    `update coaches set stripe_customer_id = coalesce($2, stripe_customer_id),
       subscription_status = $3, trial_ends_at = $4, plan = $5
     where stripe_subscription_id = $1`,
    [sub.id, customerId ?? null, sub.status, trialEndsAt?.toISOString() ?? null, storedPlan],
  );
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

export async function reconcilePlanForNextCycle(sql: Sql, coachId: string, asOf = new Date(), invoice?: Stripe.Invoice) {
  const rows = await sql.query<{
    id: string;
    plan: string;
    subscription_status: string;
    stripe_subscription_id: string | null;
  }>(`select id, plan, subscription_status, stripe_subscription_id from coaches where id = $1`, [coachId]);
  const coach = rows[0];
  if (!coach?.stripe_subscription_id || !["trialing", "active"].includes(coach.subscription_status)) return;
  const { start, end } = lastMonthRange(asOf);
  const counts = await sql.query<{ n: number }>(
    `select count(*)::int as n from lessons
     where coach_id = $1 and status = 'confirmed' and source <> 'imported_recurring'
       and start_at >= $2 and start_at < $3`,
    [coachId, start.toISOString(), end.toISOString()],
  );
  const desired = planForConfirmedCount(counts[0]?.n ?? 0);
  const desiredCents = planAmountCents(desired);
  const invoiceTotal = invoice?.total ?? invoice?.amount_due ?? null;
  if (desired === coach.plan && invoiceTotal === desiredCents) return;

  const stripe = getStripe();
  const price = priceIdForPlan(desired);
  if (!stripe || !price) return;
  const sub = await stripe.subscriptions.retrieve(coach.stripe_subscription_id);
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
  await sql.query(`update coaches set plan = $1 where id = $2`, [desired, coachId]);
}

export async function expireStaleTrial<
  T extends {
    id: string;
    subscription_status: string;
    trial_ends_at: string | Date | null;
    stripe_subscription_id?: string | null;
    plan?: string;
  },
>(sql: Sql, coach: T): Promise<T> {
  if (coach.subscription_status !== "trialing") return coach;
  if (isTrialing(coach.subscription_status, asDate(coach.trial_ends_at))) return coach;
  const stripe = getStripe();
  if (stripe && coach.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(coach.stripe_subscription_id);
      await syncCoachSubscription(sql, sub, coach.id);
      const fresh = await sql.query<T>(`select * from coaches where id = $1`, [coach.id]);
      const row = fresh[0];
      if (
        row &&
        !(row.subscription_status === "trialing" && !isTrialing(row.subscription_status, asDate(row.trial_ends_at)))
      ) {
        return row;
      }
    } catch {
      // Stripe missed trial end; fall through.
    }
  }
  await sql.query(`update coaches set subscription_status = 'active' where id = $1`, [coach.id]);
  return { ...coach, subscription_status: "active" };
}

export type { PlanId };
