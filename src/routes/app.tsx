import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppTabBar } from "@/components/bookme/app-tab-bar";
import { Logo } from "@/components/logo";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyCoach, type MyCoach } from "@/lib/bookme/api";
import { CoachContext } from "@/lib/bookme/coach-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({ component: AppLayout });

const NAV = [
  { to: "/app", label: "Schedule", icon: CalendarDays },
  { to: "/app/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/app/messages", label: "Messages", icon: MessageCircle },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/assistant", label: "Assistant", icon: Mic },
  { to: "/app/more", label: "More", icon: MoreHorizontal },
] as const;

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const [coach, setCoach] = useState<MyCoach | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [closed, setClosed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function reload() {
    getMyCoach()
      .then((res) => {
        if (!res.ok) {
          setClosed(Boolean("banned" in res && res.banned));
          setCoach(null);
        } else setCoach(res.coach);
      })
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user]);

  if (isPending) return <div className="min-h-screen bg-paper" />;
  if (!user) return <RedirectToSignIn />;
  if (closed) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <p className="font-display text-3xl">This account is closed</p>
      </main>
    );
  }

  const assistant = pathname.startsWith("/app/assistant");

  return (
    <div className={cn("flex bg-paper", assistant ? "h-dvh overflow-hidden" : "min-h-screen")}>
      <aside className="hidden w-56 shrink-0 flex-col bg-forest text-on-forest md:flex">
        <div className="px-5 py-5">
          <Logo invert to="/app" className="[&_img]:h-6 [&_img]:sm:h-7" />
        </div>
        <nav className="flex-1 px-3">
          {NAV.map((item) => {
            const on = item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
            const bookingsPending = item.to === "/app/bookings" ? coach?.pendingRequests || 0 : 0;
            const unread = item.to === "/app/messages" ? coach?.unreadMessages || 0 : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  on ? "bg-on-forest/10" : "text-on-forest/75 hover:bg-on-forest/5",
                )}
              >
                <item.icon className="size-4" strokeWidth={1.75} />
                {item.label}
                {bookingsPending ? (
                  <span className="ml-auto rounded-full bg-sage px-1.5 py-0.5 text-[10px] font-semibold text-forest">
                    {bookingsPending}
                  </span>
                ) : null}
                {unread ? (
                  <span className="ml-auto min-w-4 rounded-full bg-on-forest px-1.5 py-0.5 text-center text-[10px] font-semibold leading-4 text-forest">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl bg-on-forest/10 px-3 py-2 text-on-forest">
          <UserButton />
        </div>
      </aside>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          assistant ? "bg-cream pb-20 md:pb-0" : "pb-16 md:pb-0",
        )}
      >
        {assistant ? null : (
          <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
            <Logo to="/app" />
            <UserButton />
          </div>
        )}
        <div className={cn("min-h-0 min-w-0 flex-1", assistant && "flex flex-col")}>
          {loaded ? (
            <CoachContext.Provider value={{ coach, reload }}>
              <Outlet />
              <AppTabBar />
            </CoachContext.Provider>
          ) : (
            <div className="p-8 text-muted">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
