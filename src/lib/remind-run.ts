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
    for (const kind of kinds) {
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
        await sendMail(mail);
        sent += 1;
      }
    }
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        ...(kinds.includes("24h") ? { reminded24h: true } : {}),
        ...(kinds.includes("2h") ? { reminded2h: true } : {}),
      },
    });
  }
  return { scanned: lessons.length, sent };
}
