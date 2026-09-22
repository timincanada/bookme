import {
  CalendarDays,
  CreditCard,
  Home,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, formatWeekday, isoDate } from "@/lib/utils";

const NAV = [
  { icon: Home, label: "Home", active: true },
  { icon: CalendarDays, label: "Calendar" },
  { icon: Users, label: "Clients" },
  { icon: CreditCard, label: "Payments" },
  { icon: MessageSquare, label: "Messages" },
  { icon: Settings, label: "Settings" },
];

export function DashboardPreview({ className }: { className?: string }) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = addDays(today, -((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayIso = isoDate(today);

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-line",
        className,
      )}
    >
      <aside className="flex w-[7.25rem] shrink-0 flex-col gap-1 bg-forest px-3 py-4 text-on-forest">
        <p className="mb-3 px-2 font-sans text-sm font-semibold">BookMe</p>
        {NAV.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium",
              item.active ? "bg-on-forest/10" : "text-on-forest/70",
            )}
          >
            <item.icon className="size-3.5" strokeWidth={1.75} />
            {item.label}
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1 bg-card p-4">
        <div className="flex items-start justify-between">
          <p className="font-display text-lg font-medium tracking-tight">Your next lesson</p>
          <span className="text-xs font-medium text-forest">View all</span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-sage-3 p-3">
          <img
            src="/photos/daniel-kim.jpg"
            alt=""
            className="size-10 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Today, 4:30 PM</p>
            <p className="text-xs text-muted">Private Tennis · 60 min</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-success">$85.00 paid</span>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          This week
        </p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const iso = isoDate(d);
            const active = iso === todayIso;
            return (
              <div
                key={iso}
                className={cn(
                  "rounded-lg py-1.5 text-center",
                  active ? "bg-forest text-on-forest" : "text-ink-soft",
                )}
              >
                <div className="text-[10px]">{formatWeekday(d)}</div>
                <div className="text-sm font-semibold">{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <ul className="mt-3 divide-y divide-line text-xs">
          <Row time="8:00 AM" title="Adult Tennis" fill="1/4" />
          <Row time="10:00 AM" title="Junior Academy" fill="3/8" />
          <Row time="4:30 PM" title="Private Lesson" fill="1/1" />
        </ul>
      </div>
    </div>
  );
}

function Row({ time, title, fill }: { time: string; title: string; fill: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-16 shrink-0 tabular-nums text-muted">{time}</span>
      <span className="flex-1 font-medium">{title}</span>
      <span className="text-muted">{fill}</span>
    </li>
  );
}
