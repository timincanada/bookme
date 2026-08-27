import { prisma } from "./db";
import { formatWhen } from "./time";
import { sendLessonConfirmations } from "./mail";
import { appUrl } from "./stripe";

export async function notifyLessonConfirmed(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { coach: true, client: true, location: true, payment: true },
  });
  if (!lesson) return;
  await sendLessonConfirmations({
    coachName: lesson.coach.name,
    coachEmail: lesson.coach.email,
    studentName: lesson.client.name,
    studentEmail: lesson.client.email,
    when: formatWhen(lesson.startAt),
    location: lesson.location.name,
    manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client.email)}`,
  });
}
