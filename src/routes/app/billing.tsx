import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PlanFeatureList } from "@/components/bookme/plan-feature-list";
import { Button } from "@/components/ui/button";
import { cancelCoachPlan, setPreferredPlan, startCoachTrial } from "@/lib/bookme/api";
import { planFeatureCard } from "@/lib/bookme/plan-features";
import { PLANS, planLessonRange, planTierLabel, subscriptionStatusLabel, type PlanId } from "@/lib/bookme/subscription";
import { cn } from "@/lib/utils";
import { useCoach } from "@/lib/bookme/coach-context";
import { publicSiteUrl } from "@/lib/bookme/site";
import { openInSystemBrowser, usePurchasePolicy } from "@/lib/native/purchases";

export const Route = createFileRoute("/app/billing")({ component: Billing });

function PlanStatus({
  status,
  plan,
  trialEndsAt,
  showTierLine = true,
  showMonthTier = false,
}: {
  status: string | null | undefined;
  plan: string | null | undefined;
  trialEndsAt?: string | null;
  showTierLine?: boolean;
  /** iOS plan view has no tier cards, so the month line lives here. */
  showMonthTier?: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-card p-4 text-sm ring-1 ring-line">
      <span className="font-semibold">{subscriptionStatusLabel(status, trialEndsAt)}</span>
      {showTierLine ? <span className="mt-1 block text-muted">{planTierLabel(status, plan)}</span> : null}
      <p className="mt-2 text-muted">
        You don't pick a tier: it follows last month's confirmed lessons and changes automatically.
      </p>
      {showMonthTier && plan && plan !== "none" && status && status !== "none" ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-forest">Your tier this month</p>
      ) : null}
    </div>
  );
}

function Billing() {
  const { coach, reload } = useCoach();
  const policy = usePurchasePolicy();
  const [draft, setDraft] = useState<PlanId | null>(null);
  const [saving, setSaving] = useState(false);
  const plans = Object.values(PLANS);
  if (!coach) return null;
  if (!policy.ready) return null;
  if (!policy.showPurchases) {
    // iOS app: plan status only. No purchase, upgrade or pricing UI.
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-3xl font-medium">Plan</h1>
        <PlanStatus status={coach.status} plan={coach.plan} trialEndsAt={coach.trialEndsAt} showMonthTier />
        {policy.showExternalAccountLink ? (
          <Button variant="outline" className="mt-6" size="field" onClick={() => void openInSystemBrowser(`${publicSiteUrl()}/app/billing`)}>
            Manage account on bookme.training
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="max-w-3xl">
        <h1 className="font-display text-3xl font-medium">Subscription</h1>
        <p className="mt-2 text-ink-soft">
          3-day trial on Light, then auto-renew. Tier follows last month’s confirmed lessons. Students book without paying.
        </p>
        <PlanStatus status={coach.status} plan={coach.plan} trialEndsAt={coach.trialEndsAt} showTierLine />
      </div>
      <div
        role="radiogroup"
        aria-label="Subscription plans"
        className="mt-6 grid gap-4 lg:grid-cols-3"
        onKeyDown={(e) => {
          const order = plans.map((p) => p.id);
          const current = draft ?? (order.includes(coach.preferredPlan as PlanId) ? (coach.preferredPlan as PlanId) : order[0]);
          const i = Math.max(0, order.indexOf(current));
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(order[(i + 1) % order.length]);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setDraft(order[(i - 1 + order.length) % order.length]);
          }
        }}
      >
        {plans.map((p) => {
          const selectedId = draft ?? (coach.preferredPlan as PlanId | null);
          const selected = selectedId === p.id;
          const tab =
            selected || (!selectedId && p.id === plans[0].id) ? 0 : -1;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={tab}
              onClick={() => setDraft(p.id)}
              className={cn(
                "h-full min-w-0 rounded-2xl bg-card p-5 text-left ring-1 ring-line",
                selected && "ring-2 ring-forest",
              )}
            >
              <p className="flex items-center gap-1 font-semibold text-forest">
                {p.name}
                {selected ? <Check className="size-4" aria-hidden /> : null}
              </p>
              <p className="mt-2 font-display text-3xl">CA${p.cad}</p>
              <p className="mt-1 text-sm text-muted">{planLessonRange(p.id)}</p>
              {coach.plan === p.id && coach.status !== "none" ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-forest">Your tier this month</p>
              ) : null}
              {coach.preferredPlan === p.id ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-forest">Your choice</p>
              ) : null}
              <PlanFeatureList card={planFeatureCard(p.id)} className="mt-4" />
            </button>
          );
        })}
      </div>
      {draft ? (
        <div className="mt-4 max-w-3xl rounded-2xl bg-card p-5 ring-1 ring-line">
          <p className="font-semibold text-forest">{PLANS[draft].name}</p>
          <p className="mt-2 font-display text-3xl">CA${PLANS[draft].cad}/month</p>
          <p className="mt-1 text-sm text-muted">{planLessonRange(draft)}</p>
          <p className="mt-2 text-sm">{planFeatureCard(draft).summary}</p>
          <p className="mt-3 text-sm text-ink-soft">
            Billing is paused during early access — you won't be charged. Your tier still follows last month's confirmed lessons.
          </p>
          <Button
            className="mt-4"
            size="field"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const res = await setPreferredPlan({ data: { plan: draft } });
              setSaving(false);
              if (!res.ok) return toast.error(res.error);
              setDraft(null);
              toast.success("Plan choice saved — no charge while billing is paused.");
              reload();
            }}
          >
            {saving ? "Saving…" : `Choose ${PLANS[draft].name}`}
          </Button>
        </div>
      ) : null}
      {coach.status === "none" || coach.status === "canceled" ? (
        <Button className="mt-6 max-w-3xl" size="field" onClick={async () => {
          const res = await startCoachTrial();
          if (!res.ok) return toast.error("Could not start trial");
          if ("checkoutUrl" in res && res.checkoutUrl) {
            window.location.href = res.checkoutUrl;
            return;
          }
          toast.success("3-day Light trial started");
          reload();
        }}>
          Start 3-day Light trial
        </Button>
      ) : (
        <Button variant="outline" className="mt-6 max-w-3xl" size="field" onClick={async () => {
          await cancelCoachPlan();
          toast.success("Plan cancelled");
          reload();
        }}>
          Cancel plan
        </Button>
      )}
    </div>
  );
}
