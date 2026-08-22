import Link from "next/link";

const ITEMS = [
  {
    id: "schedule",
    href: "/app/schedule",
    label: "Schedule",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </svg>
    ),
  },
  {
    id: "bookings",
    href: "/app/bookings",
    label: "Bookings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 5h8a2 2 0 0 1 2 2v12H6V7a2 2 0 0 1 2-2z" />
        <path d="M9 11h6M9 15h4" />
      </svg>
    ),
  },
  {
    id: "clients",
    href: "/app/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3 2.6-4.5 5.5-4.5S14.4 16 15 19" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M16.5 19c.3-2 1.5-3.2 3.5-3.6" />
      </svg>
    ),
  },
  {
    id: "more",
    href: "/app/more",
    label: "More",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6.5" cy="12" r="1.4" fill="currentColor" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        <circle cx="17.5" cy="12" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
] as const;

export function TabBar({ active }: { active: (typeof ITEMS)[number]["id"] }) {
  return (
    <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t border-line bg-surface pb-[max(10px,env(safe-area-inset-bottom))] pt-2 text-[11px]">
      {ITEMS.map((item) => {
        const on = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 ${on ? "font-semibold text-brand" : "text-muted"}`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
