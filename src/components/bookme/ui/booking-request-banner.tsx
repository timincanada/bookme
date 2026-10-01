import { Link } from "@tanstack/react-router";

export function BookingRequestBanner({ count }: { count: number }) {
  if (!count) return null;
  const label = count === 1 ? "1 booking request" : `${count} booking requests`;
  return (
    <Link
      to="/app/bookings"
      search={{ tab: "requests", swap: undefined }}
      className="mt-4 flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-card)] bg-sage-3 px-4 text-ink"
    >
      <span className="text-base font-semibold">{label}</span>
      <span className="shrink-0 text-base font-semibold text-forest">Review →</span>
    </Link>
  );
}
