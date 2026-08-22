import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { CollectButton } from "@/components/CollectButton";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatTime } from "@/lib/time";
import { canCopyBookingLink, isSetupComplete } from "@/lib/setup";
import Link from "next/link";

function payLabel(status?: string | null, method?: string | null) {
  if (status === "paid") return { text: "Paid", kind: "paid" };
  if (status === "marked_offline") return { text: "Collected offline", kind: "offline" };
  if (method === "cash" && status === "unpaid") return { text: "Unpaid", kind: "unpaid" };
  return { text: status || "Unpaid", kind: "other" };
}

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
  const publish = canCopyBookingLink(setup, coach.subscriptionStatus);
  const lessons = await prisma.lesson.findMany({
    where: { coachId: coach.id, status: { in: ["confirmed", "held"] } },
    include: { client: true, location: true, payment: true, service: true },
    orderBy: { startAt: "asc" },
  });
  return (
    <main className="phone px-5 pb-24">
      <Brand
        right={
          <div className="h-8 w-8 rounded-full bg-emerald-100 text-center text-sm leading-8 font-semibold text-[#059669]">
            {coach.name.slice(0, 1)}
          </div>
        }
      />
      <h1 className="text-2xl font-bold">My Schedule</h1>
      <p className="text-slate-500">{lessons.length} upcoming lessons</p>
      {!setup && (
        <Link href="/app/setup" className="mt-4 block rounded-xl bg-[#D1FAE5] p-3 text-sm font-semibold text-[#059669]">
          Finish Open for business to publish your link
        </Link>
      )}
      {setup && !publish && (
        <Link href="/app/billing" className="mt-4 block rounded-xl bg-[#D1FAE5] p-3 text-sm font-semibold text-[#059669]">
          Start a trial to copy your booking link
        </Link>
      )}
      <ul className="mt-5 space-y-3">
        {lessons.map((l) => {
          const pay = payLabel(l.payment?.status, l.payment?.method);
          return (
            <li key={l.id} className="rounded-xl border border-slate-200 p-4">
              <Link href={`/app/lessons/${l.id}`} className="block">
              <div className="font-semibold">{formatTime(l.startAt)}</div>
              <div>Private · {l.client.name}</div>
              <div className="text-sm text-slate-500">{l.location.name}</div>
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {l.payment?.method === "cash" && l.payment.status === "unpaid" ? (
                  <CollectButton lessonId={l.id} />
                ) : pay.kind === "paid" ? (
                  <span className="rounded-full bg-[#10B981] px-2 py-0.5 text-white">Paid</span>
                ) : pay.kind === "offline" ? (
                  <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">Collected offline</span>
                ) : (
                  <span className="rounded-full border px-2 py-0.5">{pay.text}</span>
                )}
                <span className="rounded-full border px-2 py-0.5 text-slate-500">Confirmed</span>
              </div>
            </li>
          );
        })}
        {lessons.length === 0 && <p className="text-slate-500">No lessons yet.</p>}
      </ul>
      <TabBar active="schedule" />
    </main>
  );
}
