import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelCoachPlan, startCoachTrial } from "@/lib/bookme/api";
import { PLANS, planTierLabel, subscriptionStatusLabel } from "@/lib/bookme/subscription";
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
}: {
  status: string | null | undefined;
  plan: string | null | undefined;
  trialEndsAt?: string | null;
  showTierLine?: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-card p-4 text-sm ring-1 ring-line">
      <span className="font-semibold">{subscriptionStatusLabel(status, trialEndsAt)}</span>
      {showTierLine ? <span className="mt-1 block text-muted">{planTierLabel(status, plan)}</span> : null}
      <p className="mt-2 text-muted">
        You don't pick a tier: it follows last month's confirmed lessons and changes automatically.
      </p>
      {plan && plan !== "none" && status && status !== "none" ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-forest">Your tier this month</p>
      ) : null}
    </div>
  );
}

function Billing() {
  const { coach, reload } = useCoach();
  const policy = usePurchasePolicy();
  if (!coach) return null;
  if (!policy.ready) return null;
  if (!policy.showPurchases) {
    // iOS app: plan status only. No purchase, upgrade or pricing UI.
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-3xl font-medium">Plan</h1>
        <PlanStatus status={coach.status} plan={coach.plan} trialEndsAt={coach.trialEndsAt} />
        {policy.showExternalAccountLink ? (
          <Button variant="outline" className="mt-6" size="field" onClick={() => void openInSystemBrowser(`${publicSiteUrl()}/app/billing`)}>
            Manage account on bookme.training
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-3xl font-medium">Subscription</h1>
      <p className="mt-2 text-ink-soft">
        3-day trial on Light, then auto-renew. Tier follows last month’s confirmed lessons. Students book without paying.
      </p>
      <PlanStatus status={coach.status} plan={coach.plan} trialEndsAt={coach.trialEndsAt} showTierLine />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(Object.values(PLANS) as Array<(typeof PLANS)[keyof typeof PLANS]>).map((p) => (
          <article key={p.id} className={cn("rounded-2xl bg-card p-5 ring-1 ring-line", coach.plan === p.id && "ring-2 ring-forest")}>
            <p className="font-semibold text-forest">{p.name}</p>
            <p className="mt-2 font-display text-3xl">CA${p.cad}</p>
            <p className="mt-1 text-sm text-muted">
              {p.max === Infinity ? "61+ confirmed lessons / month" : p.id === "light" ? "Up to 20 confirmed lessons / month" : "21–60 confirmed lessons / month"}
            </p>
            {coach.plan === p.id && coach.status !== "none" ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-forest">Your tier this month</p>
            ) : null}
            {p.capabilities.length ? (
              <p className="mt-3 flex items-center gap-1 text-sm">
                <Check className="size-4 text-forest" /> Assistant
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">Assistant on Coach & Busy</p>
            )}
          </article>
        ))}
      </div>
      {coach.status === "none" || coach.status === "canceled" ? (
        <Button className="mt-6" size="field" onClick={async () => {
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
        <Button variant="outline" className="mt-6" size="field" onClick={async () => {
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
