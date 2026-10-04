import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type SegmentTab = {
  id: string;
  label: string;
  to: "/app/bookings";
  search: { tab: "upcoming" | "requests" | "completed" | "cancelled"; swap: string | undefined };
};

/** Four status tabs in one row. Labels stay on one line and fit the phone column. */
export function SegmentedTabs({ tabs, active }: { tabs: SegmentTab[]; active: string }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Booking status">
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            search={tab.search}
            role="tab"
            aria-selected={on}
            className={cn(
              "inline-flex min-h-11 min-w-0 items-center justify-center rounded-[var(--radius-pill)] px-1 text-center text-[11px] font-medium tracking-tight whitespace-nowrap ring-1 transition-colors duration-150 min-[360px]:px-1.5 min-[360px]:text-xs min-[400px]:px-2 min-[400px]:text-[13px] md:px-4 md:text-sm md:tracking-normal",
              on ? "bg-forest text-on-forest ring-forest" : "bg-card text-ink ring-line",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
