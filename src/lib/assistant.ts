export type Capability = "list_availability" | "draft_email" | "draft_reschedule";

export type ClientHit = { id: string; name: string };
export type LessonHit = { id: string; clientId: string; clientName: string; startAt: string; status: string; location?: string };

export type AssistantAction =
  | { type: "list_availability"; dateKey: string; days: number }
  | { type: "draft_email"; lessonId: string; body: string }
  | { type: "draft_reschedule"; op: "move"; lessonId: string; start: string }
  | { type: "draft_reschedule"; op: "block"; dateKey: string; startMin: number; endMin: number };

export type ParseResult =
  | { ok: true; action: AssistantAction; summary: string; needsConfirm: boolean }
  | { ok: false; error: string };

const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function norm(s: string) { return String(s || "").trim().toLowerCase(); }

export function findClient(clients: ClientHit[], text: string) {
  const t = norm(text);
  const hits = clients.filter((c) => t.includes(norm(c.name)));
  if (hits.length === 1) return hits[0];
  const first = clients.filter((c) => { const n = norm(c.name).split(/\s+/)[0]; return n.length > 1 && t.includes(n); });
  if (first.length === 1) return first[0];
  return null;
}

export function nextLessonForClient(lessons: LessonHit[], clientId: string, nowIso?: string) {
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const open = lessons
    .filter((l) => l.clientId === clientId && l.status === "confirmed" && new Date(l.startAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return open[0] || null;
}

export function shiftDateKey(dateKey: string, days: number) {
  const d = new Date(dateKey + "T12:00:00-04:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

export function nextWeekdayKey(todayKey: string, weekday: number) {
  const d = new Date(todayKey + "T12:00:00-04:00");
  const add = (weekday - d.getDay() + 7) % 7;
  return shiftDateKey(todayKey, add);
}

export function dateKeyFromText(text: string, todayKey: string) {
  const t = norm(text);
  if (/\btoday\b/.test(t)) return todayKey;
  if (/\btomorrow\b/.test(t)) return shiftDateKey(todayKey, 1);
  const iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (t.includes(WEEKDAYS[i]) || t.includes(WEEKDAYS[i].slice(0, 3))) return nextWeekdayKey(todayKey, i);
  }
  return todayKey;
}

function afternoonRange(text: string) {
  const t = norm(text);
  if (/\bmorning\b/.test(t)) return { startMin: 8 * 60, endMin: 12 * 60, label: "8:00 a.m.–12:00 p.m." };
  if (/\bevening\b/.test(t)) return { startMin: 17 * 60, endMin: 21 * 60, label: "5:00–9:00 p.m." };
  return { startMin: 12 * 60, endMin: 18 * 60, label: "12:00–6:00 p.m." };
}

function emailDraft(lesson: LessonHit, extra?: string) {
  const when = lesson.startAt;
  const loc = lesson.location ? " at " + lesson.location : "";
  const extraBit = extra && extra.length > 2 ? extra : "just a reminder about our lesson";
  return "Hi " + lesson.clientName.split(" ")[0] + ", " + extraBit + ". See you then.";
}

export function parseAssistant(text: string, ctx: { todayKey: string; clients: ClientHit[]; lessons: LessonHit[] }): ParseResult {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Say something to your assistant." };
  const t = norm(raw);

  const wantsList = /\b(availab|opening|openings|open slot|open time|what.?s open|free time|this week)\b/.test(t) || t === "openings this week";
  const wantsEmail = /\b(email|message|tell|remind)\b/.test(t);
  const wantsBlock = /\b(block|close|change hours|hours)\b/.test(t);
  const wantsMove = /\b(move|reschedule)\b/.test(t);

  if (wantsEmail) {
    const client = findClient(ctx.clients, raw);
    if (!client) return { ok: false, error: "Name the student on the lesson to email." };
    const lesson = nextLessonForClient(ctx.lessons, client.id);
    if (!lesson) return { ok: false, error: "No upcoming confirmed lesson for " + client.name + " to email about." };
    const rest = raw.replace(new RegExp("(?:email|message|tell|remind)\\s+" + client.name.split(" ")[0], "i"), "").trim();
    const body = emailDraft(lesson, rest.replace(client.name, "").trim());
    return { ok: true, needsConfirm: true, action: { type: "draft_email", lessonId: lesson.id, body }, summary: "Email " + client.name + " about their lesson." };
  }

  if (wantsMove) {
    const client = findClient(ctx.clients, raw);
    if (!client) return { ok: false, error: "Name the student to reschedule." };
    const lesson = nextLessonForClient(ctx.lessons, client.id);
    if (!lesson) return { ok: false, error: "No upcoming confirmed lesson for " + client.name + "." };
    const dateKey = dateKeyFromText(raw, ctx.todayKey);
    const hm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if (!hm) return { ok: false, error: "Say the new time, like Thursday 5:00 pm." };
    let hour = Number(hm[1]);
    const min = hm[2] ? Number(hm[2]) : 0;
    if (hm[3] === "pm" && hour < 12) hour += 12;
    if (hm[3] === "am" && hour === 12) hour = 0;
    const start = new Date(dateKey + "T" + String(hour).padStart(2, "0") + ":" + String(min).padStart(2, "0") + ":00-04:00");
    return { ok: true, needsConfirm: true, action: { type: "draft_reschedule", op: "move", lessonId: lesson.id, start: start.toISOString() }, summary: "Move the lesson with " + client.name + "." };
  }

  if (wantsBlock) {
    const hasDay = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/.test(t);
    if (!hasDay) return { ok: false, error: "Which day should I block?" };
    const dateKey = dateKeyFromText(raw, ctx.todayKey);
    const range = afternoonRange(raw);
    return { ok: true, needsConfirm: true, action: { type: "draft_reschedule", op: "block", dateKey, startMin: range.startMin, endMin: range.endMin }, summary: "Block " + dateKey + " " + range.label + "." };
  }

  if (wantsList) {
    const days = /\bweek\b/.test(t) ? 7 : 1;
    const dateKey = days === 7 ? ctx.todayKey : dateKeyFromText(raw, ctx.todayKey);
    return { ok: true, needsConfirm: false, action: { type: "list_availability", dateKey, days }, summary: days === 7 ? "Openings this week." : "Open times on " + dateKey + "." };
  }

  return { ok: false, error: "Try: openings this week, email Alex about Tuesday, or block Thursday afternoon." };
}
