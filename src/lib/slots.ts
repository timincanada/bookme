import { prisma } from "./db";
import { isHoldOpen } from "./hold";

export function overlapsBlock(m: number, duration: number, startMin?: number | null, endMin?: number | null) {
  const blockStart = startMin ?? 0;
  const blockEnd = endMin ?? 1440;
  return m < blockEnd && m + duration > blockStart;
}

export async function expireHolds(coachId?: string) {
  const now = new Date();
  await prisma.lesson.updateMany({
    where: {
      status: "held",
      holdUntil: { lt: now },
      ...(coachId ? { coachId } : {}),
    },
    data: { status: "expired" },
  });
}

export async function openSlots(coachId: string, dateKey: string, durationMin: number) {
  await expireHolds(coachId);
  const date = new Date(`${dateKey}T12:00:00-04:00`);
  const weekday = date.getDay();
  const hours = await prisma.weeklyHour.findMany({ where: { coachId, weekday } });
  const blocks = await prisma.dateBlock.findMany({ where: { coachId, date: dateKey } });
  if (hours.length === 0) return [];

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
      if (blocks.some((b) => overlapsBlock(m, durationMin, b.startMin, b.endMin))) continue;
      const start = new Date(dayStart.getTime() + m * 60 * 1000);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);
      if (start < new Date()) continue;
      const clash = taken.some((l) => {
        if (l.status === "held" && !isHoldOpen(l.holdUntil)) return false;
        return l.startAt < end && l.endAt > start;
      });
      if (!clash) slots.push(start.toISOString());
    }
  }
  return slots;
}
