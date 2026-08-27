import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { bookingBucket, lessonStatusLabel } from "@/lib/bookings";
import { formatWhen } from "@/lib/time";
import { StatusChip } from "@/components/PayChip";

const TABS = ["upcoming", "completed", "cancelled"] as const;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const tab = (TABS.includes(searchParams.tab as (typeof TABS)[number])
    ? searchParams.tab
    : "upcoming") as (typeof TABS)[number];
  const lessons = await prisma.lesson.findMany({
    where: { coachId: coach.id },
    include: { client: true, location: true },
    orderBy: { startAt: "asc" },
  });
  const now = new Date();
  const grouped = {
    upcoming: lessons.filter((l) => bookingBucket(l.status, l.startAt, now) === "upcoming"),
    completed: lessons.filter((l) => bookingBucket(l.status, l.startAt, now) === "completed"),
    cancelled: lessons.filter((l) => bookingBucket(l.status, l.startAt, now) === "cancelled"),
  };
  const rows = grouped[tab];
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">Bookings</h1>
      <p className="text-muted">All lessons. This is not an approval inbox.</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/app/bookings?tab=${t}`}
            className={`rounded-xl border py-2 text-center capitalize ${tab === t ? "border-brand bg-brand-soft font-semibold" : "border-line"}`}
          >
            {t}
          </Link>
        ))}
      </div>
      <ul className="mt-5 space-y-3">
        {rows.map((l) => (
          <li key={l.id}>
            <Link href={`/app/lessons/${l.id}`} className="block card">
              <div className="font-semibold">{formatWhen(l.startAt)}</div>
              <div>Private · {l.client.name}</div>
              <div className="text-sm text-muted">{l.location.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip>{lessonStatusLabel(l.status)}</StatusChip>
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <p className="text-muted">No {tab} lessons.</p>}
      </ul>
      <TabBar active="bookings" />
    </main>
  );
}
