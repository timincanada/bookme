import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { useCoach } from "@/lib/bookme/coach-context";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    to: "/app",
    label: "Schedule",
    icon: CalendarDays,
    match: (p: string) =>
      p === "/app" || p.startsWith("/app/schedule") || p.startsWith("/app/lessons"),
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
    match: (p: string) =>
      p.startsWith("/app/more") || p.startsWith("/app/setup") || p.startsWith("/app/billing"),
  },
] as const;

export function AppTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { coach } = useCoach();
  const pending = coach?.pendingRequests || 0;
  const unread = coach?.unreadMessages || 0;
  return (
    <nav className="type-tab fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-card pb-[max(10px,env(safe-area-inset-bottom))] pt-2 md:hidden">
      {ITEMS.map((item) => {
        const on = item.match(pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 whitespace-nowrap py-1",
              on ? "font-semibold text-forest" : "text-muted",
            )}
          >
            <span className="relative">
              <item.icon className="size-5" strokeWidth={1.8} />
              {item.to === "/app/bookings" && pending ? (
                <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-forest" />
              ) : null}
              {item.to === "/app/messages" && unread ? (
                <span className="absolute -right-2.5 -top-2 min-w-5 rounded-full bg-forest px-1 text-center text-[13px] font-semibold leading-4 text-on-forest">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
