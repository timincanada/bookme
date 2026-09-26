import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AccountMenu } from "@/components/bookme/account-menu";
import { AppTabBar } from "@/components/bookme/app-tab-bar";
import { Logo } from "@/components/logo";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyCoach, type MyCoach } from "@/lib/bookme/api";
import { CoachContext } from "@/lib/bookme/coach-context";
import { useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({ component: AppLayout });

/** `/app/messages/:clientId` only — the inbox index stays a normal page. */
function isCoachThreadPath(pathname: string) {
  return /^\/app\/messages\/[^/]+\/?$/.test(pathname);
}

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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const chatThread = isCoachThreadPath(pathname);

  function reload() {
    return getMyCoach()
      .then((res) => {
        if (!res.ok) {
          setClosed(Boolean("banned" in res && res.banned));
          setCoach(null);
        } else setCoach(res.coach);
      })
      .finally(() => setLoaded(true));
  }

  // Background refetch only. A non-ok or thrown getMyCoach must not blank the shell.
  function refreshCoach() {
    return getMyCoach()
      .then((res) => {
        if (!res.ok) {
          if ("banned" in res && res.banned) setClosed(true);
          return;
        }
        setCoach(res.coach);
      })
      .catch(() => {
        /* transient failure */
      });
  }

  useLessonsRefresh(
    () => {
      if (!user) return;
      void refreshCoach();
    },
    { pathname },
  );

  useEffect(() => {
    if (!user) return;
    reload();
  }, [user]);

  // Keep the thread shell on the visual viewport (dvh does not shrink for the iOS keyboard).
  useEffect(() => {
    if (!chatThread || isPending || !user || closed) return;
    const shell = shellRef.current;
    const vv = window.visualViewport;
    if (!shell || !vv) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      if (!mq.matches) {
        shell.style.height = "";
        shell.style.position = "";
        shell.style.top = "";
        shell.style.left = "";
        shell.style.right = "";
        setKeyboardOpen(false);
        return;
      }
      shell.style.height = `${vv.height}px`;
      if (vv.offsetTop > 0) {
        shell.style.position = "fixed";
        shell.style.top = `${vv.offsetTop}px`;
        shell.style.left = "0";
        shell.style.right = "0";
      } else {
        shell.style.position = "";
        shell.style.top = "";
        shell.style.left = "";
        shell.style.right = "";
      }
      const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const next = obscured > 150;
      setKeyboardOpen((prev) => (prev === next ? prev : next));
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    mq.addEventListener("change", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      mq.removeEventListener("change", sync);
      shell.style.height = "";
      shell.style.position = "";
      shell.style.top = "";
      shell.style.left = "";
      shell.style.right = "";
      setKeyboardOpen(false);
    };
  }, [chatThread, isPending, user, closed]);

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
  const fillViewport = assistant || chatThread;

  return (
    <CoachContext.Provider value={{ coach, reload }}>
      <div
        ref={shellRef}
        className={cn("flex bg-paper", fillViewport ? "h-dvh overflow-hidden" : "min-h-screen")}
      >
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
            <AccountMenu name={coach?.name} email={coach?.email} showName />
          </div>
        </aside>
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            assistant
              ? "bg-cream pb-20 md:pb-0"
              : chatThread
                ? keyboardOpen
                  ? "pb-0"
                  : "pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0"
                : "pb-16 md:pb-0",
          )}
        >
          {assistant ? null : (
            <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
              <Logo to="/app" />
              <AccountMenu name={coach?.name} email={coach?.email} />
            </div>
          )}
          <div className={cn("min-h-0 min-w-0 flex-1", fillViewport && "flex flex-col")}>
            {loaded ? (
              <>
                <Outlet />
                <AppTabBar />
              </>
            ) : (
              <div className="p-8 text-muted">Loading…</div>
            )}
          </div>
        </div>
      </div>
    </CoachContext.Provider>
  );
}
