export type Capability = "list_availability" | "message_student" | "mutate_schedule";

export type ClientHit = { id: string; name: string };
export type LessonHit = { id: string; clientId: string; clientName: string; startAt: string; status: string };

export type AssistantAction =
  | { type: "list_availability"; dateKey: string }
  | { type: "message_student"; clientId: string; body: string }
  | { type: "mutate_schedule"; op: "cancel" | "move"; lessonId: string; start?: string };

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
    if (t.includes(WEEKDAYS[i])) return nextWeekdayKey(todayKey, i);
  }
  return todayKey;
}

function messageBody(text: string, clientName: string) {
  const re = new RegExp("(?:message|email|text|tell|remind)\\s+" + clientName + "\\s*[:\\-]?\\s*", "i");
  const cut = text.trim().replace(re, "").trim();
  if (cut && cut.toLowerCase() !== clientName.toLowerCase()) return cut;
  return "Hi " + clientName + ", a note from your coach.";
}

export function parseAssistant(text: string, ctx: { todayKey: string; clients: ClientHit[]; lessons: LessonHit[] }): ParseResult {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Say something to your assistant." };
  const t = norm(raw);
  const wantsList = /\b(availab|open slot|open time|what.?s open|free time|my hours|open|slots?)\b/.test(t);
  const wantsMsg = /\b(message|email|text|tell|remind)\b/.test(t);
  const wantsCancel = /\bcancel\b/.test(t);
  const wantsMove = /\b(move|reschedule)\b/.test(t);

  if (wantsMsg) {
    const client = findClient(ctx.clients, raw);
    if (!client) return { ok: false, error: "Name the student to message." };
    const body = messageBody(raw, client.name);
    return { ok: true, needsConfirm: true, action: { type: "message_student", clientId: client.id, body }, summary: "Email " + client.name + ": " + body };
  }

  if (wantsCancel || wantsMove) {
    const client = findClient(ctx.clients, raw);
    if (!client) return { ok: false, error: "Name the student to change the lesson." };
    const lesson = nextLessonForClient(ctx.lessons, client.id);
    if (!lesson) return { ok: false, error: "No upcoming confirmed lesson for " + client.name + "." };
    if (wantsCancel) {
      return { ok: true, needsConfirm: true, action: { type: "mutate_schedule", op: "cancel", lessonId: lesson.id }, summary: "Cancel the lesson with " + client.name + "." };
    }
    const dateKey = dateKeyFromText(raw, ctx.todayKey);
    const hm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if (!hm) return { ok: false, error: "Say the new time, like Thursday 5:00 pm." };
    let hour = Number(hm[1]);
    const min = hm[2] ? Number(hm[2]) : 0;
    if (hm[3] === "pm" && hour < 12) hour += 12;
    if (hm[3] === "am" && hour === 12) hour = 0;
    const hh = String(hour).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    const start = new Date(dateKey + "T" + hh + ":" + mm + ":00-04:00");
    return { ok: true, needsConfirm: true, action: { type: "mutate_schedule", op: "move", lessonId: lesson.id, start: start.toISOString() }, summary: "Move the lesson with " + client.name + "." };
  }

  if (wantsList) {
    const dateKey = dateKeyFromText(raw, ctx.todayKey);
    return { ok: true, needsConfirm: false, action: { type: "list_availability", dateKey }, summary: "Open times on " + dateKey + "." };
  }

  return { ok: false, error: "Try: open times tomorrow, message Emma practice serve, or cancel Emma." };
}
