export const TZ = "America/Toronto";

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatWhen(d: Date) {
  return d.toLocaleString("en-CA", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString("en-CA", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function startOfDay(dateKey: string) {
  return new Date(`${dateKey}T00:00:00-04:00`);
}

export function torontoDateKey(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Sunday-first cells for a civil month. null = leading pad. month is 1-12. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const firstKey = `${year}-${pad(month)}-01`;
  const firstWeekday = new Date(`${firstKey}T12:00:00`).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
