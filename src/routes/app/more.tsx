import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BookingShare } from "@/components/bookme/booking-share";
import { PageFrame } from "@/components/bookme/ui/page-frame";
import { PageTitle } from "@/components/bookme/ui/page-title";
import { SettingGroup } from "@/components/bookme/ui/setting-group";
import { SettingRow, type SettingRoute } from "@/components/bookme/ui/setting-row";
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

  async function copyDesk() {
    const live = liveManageUrl();
    if (await shareLink({ title: "Student desk", url: live })) return;
    await navigator.clipboard.writeText(live);
    setCopied(true);
    toast.success("Copied " + displayManageLink());
    window.setTimeout(() => setCopied(false), 1800);
  }

  const groups: { title: string; rows: { to: SettingRoute; label: string }[] }[] = [
    {
      title: "Booking",
      rows: [
        { to: "/app/more/hours", label: "Hours & availability" },
        { to: "/app/more/locations", label: "Locations" },
        { to: "/app/more/lessons", label: "Lessons" },
        { to: "/app/setup", label: "Open for business" },
      ],
    },
    {
      title: "Assistant",
      rows: [
        { to: "/app/assistant", label: "Assistant" },
        { to: "/app/more/assistant", label: "Assistant name" },
      ],
    },
    {
      title: "Business",
      rows: [
        { to: "/app/more/payments", label: "Payments" },
        { to: "/app/billing", label: policy.showPurchases ? "Subscription & billing" : "Plan" },
      ],
    },
    {
      title: "Account",
      rows: [{ to: "/app/more/account", label: "Account" }],
    },
  ];

  return (
    <PageFrame>
      <PageTitle title="More" subtitle="Hours, assistant, and account." />
      <div className="mt-[var(--space-section)]">
        <h2 className="font-display text-2xl font-medium leading-tight text-ink">Your booking link</h2>
        <p className="mt-1 text-base text-muted">Students use this to book a new lesson.</p>
        <div className="mt-3">
          <BookingShare
            variant="actions"
            slug={coach.slug}
            name={coach.name}
            canShare={coach.open}
            walletEnabled={coach.walletEnabled}
          />
        </div>
      </div>
      {groups.map((group) => (
        <SettingGroup key={group.title} title={group.title}>
          {group.rows.map((row) => (
            <SettingRow key={row.to} to={row.to} label={row.label} />
          ))}
        </SettingGroup>
      ))}
      <div className="mt-[var(--space-section)]">
        <BookingShare slug={coach.slug} name={coach.name} canShare={coach.open} walletEnabled={coach.walletEnabled} />
      </div>
      <div className="mt-[var(--space-section)] rounded-[var(--radius-card)] bg-card p-5 ring-1 ring-line">
        <h2 className="type-section font-display text-2xl">Student desk</h2>
        <p className="mt-1 text-sm text-muted">
          For students who already booked — move a lesson or message you. Not for new bookings.
        </p>
        <p className="mt-4 font-display text-xl">{displayManageLink()}</p>
        <Button className="mt-4" size="field" onClick={() => void copyDesk()}>
          {copied ? (
            <Check className="size-4" strokeWidth={2} />
          ) : (
            <Copy className="size-4" strokeWidth={1.75} />
          )}
          {copied ? "Copied" : "Copy desk link"}
        </Button>
        <p className="type-meta mt-3 text-xs text-muted">
          Confirmation emails already include {brandedManageUrl().replace("https://", "")}.
        </p>
      </div>
    </PageFrame>
  );
}
