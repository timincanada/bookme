import Link from "next/link";
import { Brand } from "@/components/Brand";
import { prisma } from "@/lib/db";
import { formatTime } from "@/lib/time";

export default async function SchedulePage() {
  const coach = await prisma.coach.findUnique({ where: { slug: "tim-zhang" } });
  const lessons = coach
    ? await prisma.lesson.findMany({
        where: { coachId: coach.id, status: { in: ["confirmed", "held"] } },
        include: { client: true, location: true, payment: true, service: true },
        orderBy: { startAt: "asc" },
      })
    : [];
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">My Schedule</h1>
      <p className="text-slate-500">{lessons.length} upcoming lessons</p>
      <ul className="mt-5 space-y-3">
        {lessons.map((l) => (
          <li key={l.id} className="rounded-xl border border-slate-200 p-4">
            <div className="font-semibold">{formatTime(l.startAt)}</div>
            <div>Private · {l.client.name}</div>
            <div className="text-sm text-slate-500">{l.location.name}</div>
            <div className="mt-2 text-xs">
              {l.payment?.method === "cash" && l.payment.status === "unpaid" ? (
                <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">Pay in person</span>
              ) : l.payment?.status === "paid" ? (
                <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[#059669]">Paid</span>
              ) : (
                <span className="rounded-full border px-2 py-0.5">{l.payment?.status}</span>
              )}
            </div>
          </li>
        ))}
        {lessons.length === 0 && <p className="text-slate-500">No lessons yet.</p>}
      </ul>
      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t bg-white py-3 text-xs">
        <span className="text-[#10B981] font-semibold">Schedule</span>
        <Link href="/manage">Bookings</Link>
        <Link href="/">Clients</Link>
        <Link href="/">More</Link>
      </nav>
    </main>
  );
}
