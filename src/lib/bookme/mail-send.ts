import type { Sql } from "@/lib/db";
import { sendLessonConfirmations } from "./mail";
import { appUrl } from "./stripe";
import { formatWhen } from "./time";
import { pushLater, pushToCoach } from "./push";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./timezone";

function tzOf(value: string | null | undefined) {
  return value && isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export async function notifyLessonConfirmed(sql: Sql, lessonId: string) {
  const rows = await sql.query<{
    id: string;
    start_at: string | Date;
    coach_id: string;
    coach_name: string;
    coach_email: string;
    timezone: string;
    client_name: string;
    client_email: string;
    location_name: string;
  }>(
    `select l.id, l.start_at, l.coach_id, c.name as coach_name, c.email as coach_email, c.timezone,
            cl.name as client_name, cl.email as client_email, loc.name as location_name
     from lessons l
     join coaches c on c.id = l.coach_id
     join clients cl on cl.id = l.client_id
     join locations loc on loc.id = l.location_id
     where l.id = $1`,
    [lessonId],
  );
  const lesson = rows[0];
  if (!lesson) return;
  pushLater(() =>
    pushToCoach(sql, lesson.coach_id, {
      title: "New booking",
      body: `${lesson.client_name} · ${formatWhen(asDate(lesson.start_at), tzOf(lesson.timezone))}`,
      path: `/app/lessons/${lesson.id}`,
    }),
  );
  try {
    const result = await sendLessonConfirmations({
      bookingId: lesson.id,
      coachName: lesson.coach_name,
      coachEmail: lesson.coach_email,
      studentName: lesson.client_name,
      studentEmail: lesson.client_email,
      when: formatWhen(asDate(lesson.start_at), tzOf(lesson.timezone)),
      location: lesson.location_name,
      manageUrl: `${appUrl()}/manage?email=${encodeURIComponent(lesson.client_email || "")}`,
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
