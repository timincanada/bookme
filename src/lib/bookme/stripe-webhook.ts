import type Stripe from "stripe";
import { getSql } from "@/lib/db";
import { canConfirmCheckout } from "./hold";
import { notifyLessonConfirmed } from "./mail-send";
import { getStripe } from "./stripe";
import { shouldPriceInvoiceFromLastMonth } from "./subscription";
import { reconcilePlanForNextCycle, syncCoachSubscription } from "./subscription-sync";

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function handleStripeWebhook(raw: string, signature: string | null) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return { status: 503, body: { error: "Stripe webhook is not configured" } };
  }
  if (!signature) return { status: 400, body: { error: "Missing signature" } };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return { status: 400, body: { error: "Invalid signature" } };
  }

  const sql = await getSql();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode === "subscription" || session.metadata?.kind === "coach_subscription") {
      const coachId = session.metadata?.coachId || session.client_reference_id || undefined;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncCoachSubscription(sql, sub, coachId);
      }
      return { status: 200, body: { received: true, kind: "coach_subscription" } };
    }
    const lessonId = session.metadata?.lessonId;
    if (!lessonId) return { status: 200, body: { received: true } };
    const lessons = await sql.query<{
      id: string;
      status: string;
      hold_until: string | Date | null;
    }>(`select id, status, hold_until from lessons where id = $1`, [lessonId]);
    const lesson = lessons[0];
    if (!lesson) return { status: 200, body: { received: true } };
    if (lesson.status === "confirmed") return { status: 200, body: { received: true } };
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!canConfirmCheckout(lesson.status, asDate(lesson.hold_until))) {
      // Hold lapsed, lesson not delivered: full refund, platform bears its fee.
      if (pi) await stripe.refunds.create({ payment_intent: pi, reverse_transfer: true, refund_application_fee: true });
      if (lesson.status === "held") {
        await sql.query(`update lessons set status = 'expired' where id = $1`, [lesson.id]);
      }
      await sql.query(
        `update payments set status = 'refunded', stripe_payment_intent_id = coalesce($2, stripe_payment_intent_id) where lesson_id = $1`,
        [lesson.id, pi ?? null],
      );
      return { status: 200, body: { received: true, rejected: "hold_expired" } };
    }
    await sql.query(`update lessons set status = 'confirmed' where id = $1`, [lesson.id]);
    await sql.query(
      `update payments set status = 'paid', stripe_checkout_session_id = $2, stripe_payment_intent_id = $3 where lesson_id = $1`,
      [lesson.id, session.id, pi ?? null],
    );
    await notifyLessonConfirmed(sql, lesson.id);
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const lessonId = session.metadata?.lessonId;
    if (lessonId) {
      await sql.query(`update lessons set status = 'expired' where id = $1 and status = 'held'`, [lessonId]);
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncCoachSubscription(sql, event.data.object);
  }

  if (event.type === "invoice.created") {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | { id?: string } | null;
      billing_reason?: string | null;
      period_start?: number | null;
    };
    const parent = invoice.parent as { subscription_details?: { subscription?: string | { id?: string } } } | null | undefined;
    const rawSub = invoice.subscription ?? parent?.subscription_details?.subscription;
    const subId = typeof rawSub === "string" ? rawSub : rawSub?.id;
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
      const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : null;
      if (
        shouldPriceInvoiceFromLastMonth({
          billingReason: invoice.billing_reason,
          invoiceStatus: invoice.status,
          subscriptionStatus: sub.status,
          trialEnd,
          periodStart,
        })
      ) {
        const coaches = await sql.query<{ id: string }>(
          `select id from coaches where stripe_subscription_id = $1 limit 1`,
          [subId],
        );
        if (coaches[0]) await reconcilePlanForNextCycle(sql, coaches[0].id, periodStart ?? new Date(), invoice);
      }
    }
  }

  return { status: 200, body: { received: true } };
}
