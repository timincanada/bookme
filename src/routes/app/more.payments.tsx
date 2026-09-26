import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { connectStripe, saveAcceptedMethods } from "@/lib/bookme/api";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/more/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const { coach, reload } = useCoach();
  const [busy, setBusy] = useState(false);
  if (!coach) return null;

  async function toggle(next: { acceptCard: boolean; acceptCash: boolean }) {
    const res = await saveAcceptedMethods({ data: next });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    reload();
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="type-action text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="type-page mt-3 font-display text-3xl font-medium">Payments</h1>
      <p className="mt-2 text-muted">Students can pay cash in person. Card needs Stripe Connect.</p>

      <div className="mt-6 space-y-3 rounded-2xl bg-card p-5 ring-1 ring-line">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="type-key block font-semibold">Cash</span>
            <span className="type-secondary text-sm text-muted">Confirm now, collect later</span>
          </span>
          <input
            type="checkbox"
            checked={coach.acceptCash}
            onChange={(e) => toggle({ acceptCard: coach.acceptCard, acceptCash: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="type-key block font-semibold">Card</span>
            <span className="type-secondary text-sm text-muted">
              {coach.stripeConnected ? "Stripe connected" : "Connect Stripe first"}
            </span>
          </span>
          <input
            type="checkbox"
            checked={coach.acceptCard && coach.stripeConnected}
            disabled={!coach.stripeConnected}
            onChange={(e) => toggle({ acceptCard: e.target.checked, acceptCash: coach.acceptCash })}
          />
        </label>
      </div>

      {coach.stripeConfigured ? (
        <Button
          className="mt-6"
          size="field"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await connectStripe();
            setBusy(false);
            if (!res.ok) return toast.error(res.error);
            if (res.url) window.location.href = res.url;
          }}
        >
          {coach.stripeConnected ? "Manage Stripe Connect" : "Connect Stripe"}
        </Button>
      ) : (
        <p className="mt-6 text-sm text-muted">Stripe keys are not set in this environment. Cash bookings still work.</p>
      )}
    </div>
  );
}
