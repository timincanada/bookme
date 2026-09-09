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
  try {
    const result = await sendLessonConfirmations({
      bookingId: lesson.id,
      coachName: lesson.coach.name,
      coachEmail: lesson.coach.email,
      studentName: lesson.client.name,
      studentEmail: lesson.client.email,
      when: formatWhen(lesson.startAt),
      location: lesson.location.name,
      manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client.email)}`,
    });
    if (!result.ok) {
      console.log(
        JSON.stringify({
          msg: "notify_lesson_confirmed_failed",
          bookingId: lesson.id,
          error: result.error,
        }),
      );
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        msg: "notify_lesson_confirmed_failed",
        bookingId: lesson.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
