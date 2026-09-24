import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useCoach } from "@/lib/bookme/coach-context";
import { forgetDevice } from "@/lib/native/device";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

type AccountMenuProps = {
  name?: string | null;
  email?: string | null;
  showName?: boolean;
};

/** Avatar menu in the coach app shell: Account, Subscription, setup, Sign out. */
export function AccountMenu({ name, email, showName = false }: AccountMenuProps) {
  const { coach } = useCoach();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const displayName = name || coach?.name || user?.displayName || user?.primaryEmail || "Account";
  const displayEmail = email || coach?.email || user?.primaryEmail || "";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = [
    { to: "/app/more/account" as const, label: "Account" },
    { to: "/app/billing" as const, label: "Subscription" },
    { to: "/app/setup" as const, label: "Booking page setup" },
  ];

  return (
    <div ref={wrap} className={cn("relative", showName && "flex items-center gap-2")}>
      {showName ? <span className="max-w-[8rem] truncate text-sm font-medium">{displayName}</span> : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-sm font-semibold text-on-forest"
      >
        {initials(displayName)}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl bg-card text-ink shadow-card ring-1 ring-line"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            {displayEmail ? <p className="truncate text-xs text-muted">{displayEmail}</p> : null}
          </div>
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm hover:bg-paper-2"
            >
              {i.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className="w-full border-t border-line px-4 py-3 text-left text-sm text-coral hover:bg-paper-2"
            onClick={async () => {
              setOpen(false);
              await forgetDevice();
              await authClient.signOut().catch(() => undefined);
              window.location.assign("/welcome");
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
