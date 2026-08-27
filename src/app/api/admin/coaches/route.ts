import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conversionLabel, formatPlanLabel, formatStatusLabel, grantLabel, paidSubscription, stripeFeeLabel } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { effectiveSubscriptionStatus } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const paidOnly = req.nextUrl.searchParams.get("paid") === "1";
  const [registeredCoaches, publicUniqueVisitors, coaches] = await Promise.all([
    prisma.coach.count(),
    prisma.publicVisitor.count().catch(() => 0),
    prisma.coach.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        banned: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        accessGrant: true,
      },
    }),
  ]);

  const filtered = paidOnly
    ? coaches.filter((c) => paidSubscription(c.subscriptionStatus, c.trialEndsAt))
    : coaches;

  const stripe = getStripe();

  const rows = await Promise.all(
    filtered.map(async (coach) => {
      let stripeRaw: string | null = null;
      let feeLabel = stripeFeeLabel({ hasRecord: false });

      if (stripe && coach.stripeCustomerId) {
        try {
          const invoices = await stripe.invoices.list({ customer: coach.stripeCustomerId, limit: 10 });
          const paidInv = invoices.data.find((inv) => inv.status === "paid" && inv.amount_paid != null);
          if (paidInv && paidInv.amount_paid != null && paidInv.currency) {
            feeLabel = stripeFeeLabel({
              hasRecord: true,
              amountPaid: paidInv.amount_paid,
              currency: paidInv.currency,
            });
          }
        } catch (err) {
          console.error("admin invoices failed", coach.id, err);
          feeLabel = stripeFeeLabel({ hasRecord: false });
        }
      }

      if (stripe && coach.stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(coach.stripeSubscriptionId);
          stripeRaw = sub.status;
        } catch (err) {
          console.error("admin subscription failed", coach.id, err);
        }
      }

      const mapped = effectiveSubscriptionStatus(coach.subscriptionStatus, coach.trialEndsAt);
      return {
        id: coach.id,
        name: coach.name,
        email: coach.email,
        slug: coach.slug,
        plan: coach.plan,
        planLabel: formatPlanLabel(coach.plan),
        subscriptionStatus: mapped,
        stripeSubscriptionStatus: stripeRaw,
        statusLabel: formatStatusLabel(coach.subscriptionStatus, coach.trialEndsAt, stripeRaw),
        trialEndsAt: coach.trialEndsAt ? coach.trialEndsAt.toISOString() : null,
        trialEndsLabel: coach.trialEndsAt ? coach.trialEndsAt.toISOString().slice(0, 10) : "—",
        feeLabel,
        banned: coach.banned,
        accessGrant: coach.accessGrant || "",
        grantLabel: grantLabel(coach.accessGrant),
      };
    }),
  );

  const onTrial = coaches.filter(
    (c) => effectiveSubscriptionStatus(c.subscriptionStatus, c.trialEndsAt) === "trialing",
  ).length;
  const subscribed = coaches.filter(
    (c) => effectiveSubscriptionStatus(c.subscriptionStatus, c.trialEndsAt) === "active",
  ).length;

  const stats = {
    registeredCoaches,
    publicUniqueVisitors,
    onTrial,
    subscribed,
    conversionLabel: conversionLabel(subscribed, registeredCoaches),
  };

  return NextResponse.json({
    ...stats,
    stats,
    coaches: rows,
  });
}
