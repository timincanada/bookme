export const REMIND_24H_MS = 24 * 60 * 60 * 1000;
export const REMIND_2H_MS = 2 * 60 * 60 * 1000;
export type RemindKind = "24h" | "2h";

export function dueReminders(
  input: {
    status: string;
    startAt: Date;
    reminded24h?: boolean;
    reminded2h?: boolean;
  },
  now = new Date(),
): RemindKind[] {
  if (input.status !== "confirmed") return [];
  const ms = input.startAt.getTime() - now.getTime();
  if (ms <= 0) return [];
  const out: RemindKind[] = [];
  if (!input.reminded24h && ms <= REMIND_24H_MS) out.push("24h");
  if (!input.reminded2h && ms <= REMIND_2H_MS) out.push("2h");
  return out;
}
