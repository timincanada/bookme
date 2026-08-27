import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { StatusChip } from "@/components/PayChip";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatTime } from "@/lib/time";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";
import { lessonStatusLabel } from "@/lib/bookings";
import Link from "next/link";

export default async function SchedulePage() {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const setup = isSetupComplete({
    title: coach.title,
    timezone: coach.timezone,
    service: coach.services[0] || null,
    locationCount: coach.locations.filter((l) => l.active).length,
    hourCount: coach.hours.length,
  });
  const publish = canCopyBookingLink(setup, coach.subscriptionStatus, coach.trialEndsAt, coach.banned);
  const lessons = await prisma.lesson.findMany({
    where: { coachId: coach.id, status: "confirmed" },
    include: { client: true, location: true, service: true },
    orderBy: { startAt: "asc" },
  });
  return (
    <main className="phone px-5 pb-24">
      <Brand
        right={
          <div className="h-8 w-8 rounded-full bg-brand-soft text-center text-sm leading-8 font-semibold text-brand-dark">
            {coach.name.slice(0, 1)}
          </div>
        }
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <Link href="/app/assistant?from=schedule" className="shrink-0 text-sm font-semibold text-brand">Assistant</Link>
      </div>
      <p className="text-muted">{lessons.length} upcoming lessons</p>
      {!setup && (
        <Link href="/app/setup" className="mt-4 block rounded-2xl bg-brand-soft p-3 text-sm font-semibold text-brand-dark">
          Finish Open for business to publish your link
        </Link>
      )}
      {setup && !publish && (
        <Link href="/app/billing" className="mt-4 block rounded-2xl bg-brand-soft p-3 text-sm font-semibold text-brand-dark">
          Start a trial to copy your booking link
        </Link>
      )}
      <ul className="mt-5 space-y-3">
        {lessons.map((l) => (
          <li key={l.id}>
            <Link href={`/app/lessons/${l.id}`} className="block card">
              <div className="font-semibold">{formatTime(l.startAt)}</div>
              <div>Private · {l.client.name}</div>
              <div className="text-sm text-muted">{l.location.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip>{lessonStatusLabel(l.status)}</StatusChip>
              </div>
            </Link>
          </li>
        ))}
        {lessons.length === 0 && <p className="text-muted">No lessons yet.</p>}
      </ul>
      <TabBar active="schedule" />
    </main>
  );
}
