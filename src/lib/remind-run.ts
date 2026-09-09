import { prisma } from "./db";
import { dueReminders, REMIND_24H_MS } from "./remind";
import { reminderMails, sendMail } from "./mail";
import { formatWhen } from "./time";
import { appUrl } from "./stripe";

export async function runReminders(now = new Date()) {
  const until = new Date(now.getTime() + REMIND_24H_MS);
  const lessons = await prisma.lesson.findMany({
    where: { status: "confirmed", startAt: { gt: now, lte: until } },
    include: { coach: true, client: true, location: true },
  });
  let sent = 0;
  for (const lesson of lessons) {
    const kinds = dueReminders(lesson, now);
    if (!kinds.length) continue;
    const manageUrl = `${appUrl()}/manage?email=${encodeURIComponent(lesson.client.email)}`;
    const succeeded: { reminded24h?: boolean; reminded2h?: boolean } = {};
    for (const kind of kinds) {
      let allOk = true;
      for (const mail of reminderMails({
        kind,
        coachName: lesson.coach.name,
        coachEmail: lesson.coach.email,
        studentName: lesson.client.name,
        studentEmail: lesson.client.email,
        when: formatWhen(lesson.startAt),
        location: lesson.location.name,
        manageUrl,
      })) {
        const result = await sendMail(mail, {
          bookingId: lesson.id,
          template: `reminder_${kind}`,
        });
        if (!result.ok) {
          allOk = false;
        } else {
          sent += 1;
        }
      }
      if (allOk) {
        if (kind === "24h") succeeded.reminded24h = true;
        if (kind === "2h") succeeded.reminded2h = true;
      }
    }
    if (succeeded.reminded24h || succeeded.reminded2h) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          ...(succeeded.reminded24h ? { reminded24h: true } : {}),
          ...(succeeded.reminded2h ? { reminded2h: true } : {}),
        },
      });
    }
  }
  return { scanned: lessons.length, sent };
}
