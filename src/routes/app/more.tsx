import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BookingShare } from "@/components/bookme/booking-share";
import { Button } from "@/components/ui/button";
import { useCoach } from "@/lib/bookme/coach-context";
import { shareLink, usePurchasePolicy } from "@/lib/native/purchases";
import { brandedManageUrl, displayManageLink, liveManageUrl } from "@/lib/bookme/booking-link";

export const Route = createFileRoute("/app/more")({ component: More });

function More() {
  const policy = usePurchasePolicy();
  const { coach } = useCoach();
  const [copied, setCopied] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/app/more") return <Outlet />;
  if (!coach) return null;

  async function copyManage() {
    const live = liveManageUrl();
    if (await shareLink({ title: "Manage your BookMe lessons", url: live })) return;
    await navigator.clipboard.writeText(live);
    setCopied(true);
    toast.success("Copied " + displayManageLink());
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-3xl font-medium">More</h1>
      <ul className="mt-5 divide-y divide-line rounded-2xl bg-card ring-1 ring-line">
        {[
          ["/app/assistant", "Assistant"],
          ["/app/more/assistant", "Assistant name"],
          ["/app/more/hours", "Hours & booking window"],
          ["/app/more/locations", "Locations"],
          ["/app/more/payments", "Payments"],
          ["/app/billing", policy.showPurchases ? "Subscription & billing" : "Plan"],
          ["/app/setup", "Open for business"],
          ["/app/more/account", "Account"],
        ].map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="block px-4 py-3 font-medium hover:bg-paper">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold">Booking page</p>
        <BookingShare slug={coach.slug} name={coach.name} canShare={coach.open} walletEnabled={coach.walletEnabled} />
      </div>
      <div className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
        <h2 className="font-display text-2xl">Student desk</h2>
        <p className="mt-1 text-sm text-muted">
          Send this to students who need to move a lesson or message you. They sign in with a code
          sent to the email on the booking — no password.
        </p>
        <p className="mt-4 font-display text-xl">{displayManageLink()}</p>
        <Button className="mt-4" size="field" onClick={() => void copyManage()}>
          {copied ? (
            <Check className="size-4" strokeWidth={2} />
          ) : (
            <Copy className="size-4" strokeWidth={1.75} />
          )}
          {copied ? "Copied" : "Copy manage link"}
        </Button>
        <p className="mt-3 text-xs text-muted">
          Confirmation emails already include {brandedManageUrl().replace("https://", "")}.
        </p>
      </div>
    </div>
  );
}
