import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, MessageCircle, Mic, MoreHorizontal, Users } from "lucide-react";
import { useCoach } from "@/lib/bookme/coach-context";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    to: "/app",
    label: "Schedule",
    icon: CalendarDays,
    match: (p: string) => p === "/app" || p.startsWith("/app/schedule") || p.startsWith("/app/lessons"),
  },
  {
    to: "/app/bookings",
    label: "Bookings",
    icon: ClipboardList,
    match: (p: string) => p.startsWith("/app/bookings"),
  },
  {
    to: "/app/messages",
    label: "Messages",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/app/messages"),
  },
  {
    to: "/app/clients",
    label: "Clients",
    icon: Users,
    match: (p: string) => p.startsWith("/app/clients"),
  },
  {
    to: "/app/assistant",
    label: "Assistant",
    icon: Mic,
    match: (p: string) => p.startsWith("/app/assistant"),
  },
  {
    to: "/app/more",
    label: "More",
    icon: MoreHorizontal,
    match: (p: string) => p.startsWith("/app/more") || p.startsWith("/app/setup") || p.startsWith("/app/billing"),
  },
] as const;

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-2 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-forest px-1 text-[10px] font-semibold leading-none text-on-forest">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Mobile primary nav. BottomNavigation is this same bar. */
export function AppTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { coach } = useCoach();
  const pending = coach?.pendingRequests || 0;
  const unread = coach?.unreadMessages || 0;
  return (
    <nav className="app-tab-bar fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-card md:hidden" aria-label="Primary">
      <div className="flex items-stretch justify-around">
        {ITEMS.map((item) => {
          const on = item.match(pathname);
          const count = item.to === "/app/bookings" ? pending : item.to === "/app/messages" && unread ? unread : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1.5 transition-colors duration-150",
                on ? "font-semibold text-forest" : "text-muted",
              )}
            >
              <span className="relative">
                <item.icon className="size-6" strokeWidth={1.75} aria-hidden />
                <CountBadge count={count} />
              </span>
              <span className="app-tab-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
