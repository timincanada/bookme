import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/for-coaches", label: "For Coaches" },
  { to: "/for-clubs", label: "For Clubs" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/pricing", label: "Pricing" },
] as const;

export function SiteHeader({ quiet }: { quiet?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header
      className={cn(
        "relative z-30 border-b border-transparent",
        quiet ? "bg-transparent" : "bg-paper/90 backdrop-blur-md border-line/60",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-[4.25rem] sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-soft lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn("transition-colors hover:text-forest", pathname === item.to && "text-forest")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <SignedIn>
            <Button asChild variant="outline" size="sm">
              <Link to="/app">Workspace</Link>
            </Button>
          </SignedIn>
          <SignedOut>
            <Link to="/login" className="px-2 text-sm font-medium text-ink-soft hover:text-forest">
              Log in
            </Link>
          </SignedOut>
          <Button asChild size="sm">
            <Link to="/start">Start free</Link>
          </Button>
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line bg-paper px-5 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium hover:bg-sage-3"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <SignedIn>
                <Button asChild variant="outline" size="field">
                  <Link to="/app">Workspace</Link>
                </Button>
              </SignedIn>
              <SignedOut>
                <Button asChild variant="outline" size="field">
                  <Link to="/login">Log in</Link>
                </Button>
              </SignedOut>
              <Button asChild size="field">
                <Link to="/start">Start free</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
