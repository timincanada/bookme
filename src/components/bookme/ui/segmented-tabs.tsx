import { Link } from "@tanstack/react-router";
import { HSCROLL } from "@/lib/bookme/ui-classes";
import { cn } from "@/lib/utils";

export type SegmentTab = {
  id: string;
  label: string;
  to: "/app/bookings";
  search: { tab: "upcoming" | "requests" | "completed" | "cancelled"; swap: string | undefined };
};

/** One non-wrapping row. Extra tabs scroll; they never drop to a second line. */
export function SegmentedTabs({ tabs, active }: { tabs: SegmentTab[]; active: string }) {
  return (
    <div className={cn(HSCROLL, "mt-4 snap-x snap-proximity pb-1")} role="tablist" aria-label="Booking status">
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
              "inline-flex min-h-11 shrink-0 snap-start items-center rounded-[var(--radius-pill)] px-4 text-sm font-medium whitespace-nowrap ring-1 transition-colors duration-150",
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
