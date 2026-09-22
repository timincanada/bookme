import type { Sql } from "@/lib/db";
import { reminderMails, sendMail } from "./mail";
import { dueReminders, REMIND_24H_MS } from "./remind";
import { appUrl } from "./stripe";
import { formatWhen } from "./time";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./timezone";

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export async function runReminders(sql: Sql, now = new Date()) {
  const until = new Date(now.getTime() + REMIND_24H_MS);
  const lessons = await sql.query<{
    id: string;
    status: string;
    start_at: string | Date;
    reminded_24h: boolean | string;
    reminded_2h: boolean | string;
    coach_name: string;
    coach_email: string;
    timezone: string;
    client_name: string;
    client_email: string;
    location_name: string;
  }>(
    `select l.id, l.status, l.start_at, l.reminded_24h, l.reminded_2h,
            c.name as coach_name, c.email as coach_email, c.timezone,
            cl.name as client_name, cl.email as client_email,
            loc.name as location_name
     from lessons l
     join coaches c on c.id = l.coach_id
     join clients cl on cl.id = l.client_id
     join locations loc on loc.id = l.location_id
     where l.status = 'confirmed' and l.start_at > $1 and l.start_at <= $2
       and cl.email is not null and cl.email <> ''`,
    [now.toISOString(), until.toISOString()],
  );
  let sent = 0;
  for (const lesson of lessons) {
    const kinds = dueReminders(
      {
        status: lesson.status,
        startAt: asDate(lesson.start_at),
        reminded24h: lesson.reminded_24h === true || lesson.reminded_24h === "t" || lesson.reminded_24h === "true",
        reminded2h: lesson.reminded_2h === true || lesson.reminded_2h === "t" || lesson.reminded_2h === "true",
      },
      now,
    );
    if (!kinds.length) continue;
    const manageUrl = `${appUrl()}/manage?email=${encodeURIComponent(lesson.client_email)}`;
    const succeeded: { reminded24h?: boolean; reminded2h?: boolean } = {};
    for (const kind of kinds) {
      let allOk = true;
      for (const mail of reminderMails({
        kind,
        coachName: lesson.coach_name,
        coachEmail: lesson.coach_email,
        studentName: lesson.client_name,
        studentEmail: lesson.client_email,
        when: formatWhen(
          asDate(lesson.start_at),
          lesson.timezone && isValidTimezone(lesson.timezone) ? lesson.timezone : DEFAULT_TIMEZONE,
        ),
        location: lesson.location_name,
        manageUrl,
      })) {
        const result = await sendMail(mail, {
          bookingId: lesson.id,
          template: `reminder_${kind}`,
        });
        if (!result.ok) allOk = false;
        else sent += 1;
      }
      if (allOk) {
        if (kind === "24h") succeeded.reminded24h = true;
        if (kind === "2h") succeeded.reminded2h = true;
      }
    }
    if (succeeded.reminded24h || succeeded.reminded2h) {
      await sql.query(
        `update lessons set
           reminded_24h = case when $2 then true else reminded_24h end,
           reminded_2h = case when $3 then true else reminded_2h end
         where id = $1`,
        [lesson.id, !!succeeded.reminded24h, !!succeeded.reminded2h],
      );
    }
  }
  return { scanned: lessons.length, sent };
}
