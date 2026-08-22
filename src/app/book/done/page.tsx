import Link from "next/link";
import { Brand } from "@/components/Brand";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/time";

export default async function DonePage({ searchParams }: { searchParams: { id?: string } }) {
  const lesson = searchParams.id
    ? await prisma.lesson.findUnique({
        where: { id: searchParams.id },
        include: { coach: true, client: true, location: true, payment: true, service: true },
      })
    : null;
  if (!lesson) {
    return (
      <main className="phone px-5 py-8">
        <Brand />
        <p>Booking not found.</p>
      </main>
    );
  }
  return (
    <main className="phone px-5 pb-8 text-center">
      <Brand />
      {lesson.status === "held" ? (
        <>
          <h1 className="mt-4 text-2xl font-bold">Confirming payment</h1>
          <p className="text-muted">If you just paid, this updates in a few seconds. Refresh if it still says held.</p>
        </>
      ) : (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-3xl text-brand-dark">✓</div>
          <h1 className="mt-4 text-2xl font-bold">You’re booked</h1>
          <p className="text-muted">A confirmation was sent to {lesson.client.email}</p>
        </>
      )}
      <div className="mt-6 card text-left text-sm">
        <div className="font-semibold">{lesson.coach.name}</div>
        <div className="text-muted">{lesson.service.name}</div>
        <div className="mt-2">{formatWhen(lesson.startAt)}</div>
        <div>{lesson.location.name}</div>
        <div className="mt-2 font-semibold">CA${lesson.payment?.amountCad} · {lesson.payment?.method === "cash" ? "Pay in person" : lesson.payment?.status === "paid" ? "Paid" : "Card"}</div>
      </div>
      <Link href={`/manage?email=${encodeURIComponent(lesson.client.email)}`} className="mt-6 block font-semibold text-brand">Reschedule or cancel</Link>
      <p className="mt-2 text-xs text-muted">Free reschedule until 24 hours before the lesson.</p>
    </main>
  );
}
