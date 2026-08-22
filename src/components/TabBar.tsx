import Link from "next/link";

const ITEMS = [
  { id: "schedule", href: "/app/schedule", label: "Schedule" },
  { id: "bookings", href: "/app/bookings", label: "Bookings" },
  { id: "clients", href: "/app/clients", label: "Clients" },
  { id: "more", href: "/app/more", label: "More" },
] as const;

export function TabBar({ active }: { active: (typeof ITEMS)[number]["id"] }) {
  return (
    <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t bg-white py-3 text-xs">
      {ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={item.id === active ? "font-semibold text-[#10B981]" : "text-slate-500"}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
