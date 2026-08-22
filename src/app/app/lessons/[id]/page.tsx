import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { CollectButton } from "@/components/CollectButton";
import { LessonActions } from "@/components/LessonActions";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/time";
import { payLabel } from "@/lib/bookings";
import { canAcceptNewBookings } from "@/lib/subscription";

export default async function LessonDetailPage({ params }: { params: { id: string } }) {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.id },
    include: { client: true, location: true, payment: true, service: true },
  });
  if (!lesson || lesson.coachId !== coach.id) notFound();
  const pay = payLabel(lesson.payment?.status, lesson.payment?.method);
  const canMove = ["confirmed", "held"].includes(lesson.status);
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/schedule" className="text-sm font-semibold text-[#10B981]">Schedule</Link>
      <h1 className="mt-2 text-2xl font-bold">Lesson</h1>
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <div className="font-semibold">{formatWhen(lesson.startAt)}</div>
        <div className="mt-1">Private · {lesson.client.name}</div>
        <div className="text-sm text-slate-500">{lesson.client.email}</div>
        <div className="mt-2 text-sm text-slate-500">{lesson.location.name}</div>
        <div className="mt-1 text-sm">CA${lesson.payment?.amountCad || lesson.service.priceCad} · {lesson.service.duration} min</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {lesson.payment?.method === "cash" && lesson.payment.status === "unpaid" ? (
            <CollectButton lessonId={lesson.id} />
          ) : pay.kind === "paid" ? (
            <span className="rounded-full bg-[#10B981] px-2 py-0.5 text-white">Paid</span>
          ) : pay.kind === "offline" ? (
            <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">Collected offline</span>
          ) : (
            <span className="rounded-full border px-2 py-0.5">{pay.text}</span>
          )}
          <span className="rounded-full border px-2 py-0.5 capitalize text-slate-500">{lesson.status}</span>
        </div>
      </div>
      {canMove && (
        <LessonActions
          lessonId={lesson.id}
          coachSlug={coach.slug}
          confirmed={lesson.status === "confirmed"}
          canBookNext={canAcceptNewBookings(coach.subscriptionStatus)}
        />
      )}
      <TabBar active="schedule" />
    </main>
  );
}
