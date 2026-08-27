import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { StatusChip } from "@/components/PayChip";
import { LessonActions } from "@/components/LessonActions";
import { currentCoach } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/time";
import { lessonStatusLabel } from "@/lib/bookings";

export default async function LessonDetailPage({ params }: { params: { id: string } }) {
  const coach = await currentCoach();
  if (!coach) redirect("/app/login");
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.id },
    include: { client: true, location: true, service: true },
  });
  if (!lesson || lesson.coachId !== coach.id) notFound();
  const canMove = ["confirmed", "held"].includes(lesson.status);
  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/schedule" className="text-sm font-semibold text-brand">Schedule</Link>
      <h1 className="mt-2 text-2xl font-bold">Lesson</h1>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
        <div className="text-xl font-bold leading-snug text-ink">{formatWhen(lesson.startAt)}</div>
        <div className="mt-3 font-semibold">Private · {lesson.client.name}</div>
        <div className="mt-0.5 text-sm text-muted">{lesson.client.email}</div>
        <div className="mt-3 text-sm text-muted">{lesson.location.name}</div>
        <div className="mt-1 text-sm">{lesson.service.duration} min</div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <StatusChip>{lessonStatusLabel(lesson.status)}</StatusChip>
        </div>
      </div>
      {canMove && (
        <LessonActions
          lessonId={lesson.id}
          coachSlug={coach.slug}
          confirmed={lesson.status === "confirmed"}
          canBookNext={true}
        />
      )}
      <TabBar active="schedule" />
    </main>
  );
}
