import { redirect } from "next/navigation";
import { currentCoach } from "@/lib/session";
import { expireStaleTrial } from "@/lib/subscription-sync";
import { effectiveSubscriptionStatus } from "@/lib/subscription";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const fresh = await expireStaleTrial(coach);
  return (
    <BillingClient
      initialStatus={effectiveSubscriptionStatus(fresh.subscriptionStatus, fresh.trialEndsAt)}
      initialPlan={fresh.plan || "none"}
    />
  );
}
