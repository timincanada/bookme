import { prisma } from "./db";

export async function openSlots(coachId: string, dateKey: string, durationMin: number) {
  const date = new Date(`${dateKey}T12:00:00-04:00`);
  const weekday = date.getDay();
  const hours = await prisma.weeklyHour.findMany({ where: { coachId, weekday } });
  const blocked = await prisma.dateBlock.findFirst({ where: { coachId, date: dateKey } });
  if (blocked || hours.length === 0) return [];

  const dayStart = new Date(`${dateKey}T00:00:00-04:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const taken = await prisma.lesson.findMany({
    where: {
      coachId,
      startAt: { gte: dayStart, lt: dayEnd },
      status: { in: ["held", "confirmed"] },
    },
  });

  const slots: string[] = [];
  for (const h of hours) {
    for (let m = h.startMin; m + durationMin <= h.endMin; m += 60) {
      const start = new Date(dayStart.getTime() + m * 60 * 1000);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);
      if (start < new Date()) continue;
      const clash = taken.some(
        (l) => l.startAt < end && l.endAt > start
      );
      if (!clash) slots.push(start.toISOString());
    }
  }
  return slots;
}
