import type { RecurringRuleInput } from "./recurring";
import { addDaysKey, dateKeyAt, weekdayOf, zonedInstant } from "./time";

export type Capability =
  | "list_availability"
  | "list_lessons"
  | "draft_email"
  | "draft_reschedule"
  | "draft_swap"
  | "cancel_lesson"
  | "draft_import";

export type ClientHit = { id: string; name: string };
export type LessonHit = { id: string; clientId: string; clientName: string; startAt: string; status: string; location?: string };

export type AssistantAction =
  | { type: "list_availability"; dateKey: string; days: number }
  | { type: "list_lessons" }
  | { type: "draft_email"; lessonId: string; body: string }
  | { type: "draft_reschedule"; op: "move"; lessonId: string; start: string }
  | { type: "draft_reschedule"; op: "block"; dateKey: string; startMin: number; endMin: number }
  | { type: "draft_swap"; lessonAId: string; lessonBId: string; note: string }
  | { type: "cancel_lesson"; lessonId: string }
  | { type: "draft_import"; rule: RecurringRuleInput; fingerprint?: string; lang?: "zh" | "en" };

export type AssistantContext = { todayKey: string; timezone: string; clients: ClientHit[]; lessons: LessonHit[] };

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

export function findNamedClients(clients: ClientHit[], text: string) {
  const t = norm(text);
  const hits: ClientHit[] = [];
  for (const c of clients) {
    const n = norm(c.name);
    const first = n.split(/\s+/)[0];
    if ((n.length > 1 && t.includes(n)) || (first.length > 1 && t.includes(first))) {
      if (!hits.some((h) => h.id === c.id)) hits.push(c);
    }
  }
  return hits;
}

export function nextLessonForClient(lessons: LessonHit[], clientId: string, nowIso?: string) {
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const open = lessons
    .filter((l) => l.clientId === clientId && l.status === "confirmed" && new Date(l.startAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return open[0] || null;
}

export function upcomingLessons(lessons: LessonHit[], nowIso?: string) {
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  return lessons
    .filter((l) => l.status === "confirmed" && new Date(l.startAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function lessonForCancel(lessons: LessonHit[], text: string, todayKey: string, tz: string) {
  const named = findNamedClients(
    [...new Map(lessons.map((l) => [l.clientId, { id: l.clientId, name: l.clientName }])).values()],
    text,
  );
  let pool = upcomingLessons(lessons);
  if (named.length === 1) pool = pool.filter((l) => l.clientId === named[0]!.id);
  if (named.length > 1) {
    const ids = new Set(named.map((c) => c.id));
    pool = pool.filter((l) => ids.has(l.clientId));
  }
  const dateKey = dateKeyFromText(text, todayKey);
  const dated = pool.filter((l) => dateKeyAt(new Date(l.startAt), tz) === dateKey);
  if (dated.length === 1) return dated[0];
  if (pool.length === 1) return pool[0];
  if (dated.length > 1) return dated[0];
  return pool[0] || null;
}

export function shiftDateKey(dateKey: string, days: number) {
  return addDaysKey(dateKey, days);
}

export function nextWeekdayKey(todayKey: string, weekday: number) {
  const add = (weekday - weekdayOf(todayKey) + 7) % 7;
  return shiftDateKey(todayKey, add);
}

/**
 * A request to set up a recurring schedule ("every Tuesday 4pm until March",
 * "每周二下午四点 导入固定课"). The local parser does not handle these; the
 * assistant points the coach to the import form instead.
 */
export function looksLikeImportRequest(text: string) {
  const raw = String(text || "");
  const t = norm(raw);
  if (/固定课|导入|每周|每星期|每礼拜|每两周|隔周|双周|循环课|长期课/.test(raw)) return true;
  if (/\b(import|recurring|repeating)\b/.test(t)) return true;
  if (/\bevery (other )?(week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)s?\b/.test(t)) return true;
  if (/\b(weekly|biweekly|fortnightly)\b/.test(t)) return true;
  return false;
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
  const extraBit = extra && extra.length > 2 ? extra : "just a reminder about our lesson";
  return "Hi " + lesson.clientName.split(" ")[0] + ",\n\n" + extraBit + ".";
}

export function signEmailAsCoach(body: string, coachName: string, assistantName?: string) {
  const coach = String(coachName || "").trim();
  let text = String(body || "").replace(/\s+$/g, "");
  const names = [assistantName, "Assistant", "Maya"]
    .map((n) => String(n || "").trim())
    .filter((n) => n && (!coach || n.toLowerCase() !== coach.toLowerCase()));
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp("(?:\\r?\\n)*\\s*(?:thanks|thank you|best|cheers|sincerely)[,\\s]*\\n?\\s*[-–—]*\\s*" + esc + "\\.?\\s*$", "i"),
      "",
    );
    text = text.replace(new RegExp("(?:\\r?\\n)*\\s*[-–—]\\s*" + esc + "\\.?\\s*$", "i"), "");
    text = text.replace(new RegExp("(?:\\r?\\n)+" + esc + "\\.?\\s*$", "i"), "");
  }
  text = text.replace(/(?:\r?\n)*\s*$/g, "").trim();
  if (!coach) return text;
  const coachEsc = coach.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp("(?:thanks|thank you)[,\\s]*\\n?\\s*" + coachEsc + "\\s*$", "i").test(text)) return text;
  return text + "\n\nThanks,\n" + coach;
}

export function parseAssistant(text: string, ctx: AssistantContext): ParseResult {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Say something to your assistant." };
  const t = norm(raw);

  const wantsList = /\b(availab|opening|openings|open slot|open time|what.?s open|free time|this week)\b/.test(t) || t === "openings this week";
  const wantsEmail = /\b(email|message|tell|remind)\b/.test(t);
  const wantsBlock = /\b(block|close|change hours|hours)\b/.test(t);
  const wantsSwap = /\b(swap|switch|trade)\b/.test(t) || /对调|换课/.test(raw);
  const wantsMove = /\b(move|reschedule)\b/.test(t);
  const wantsCancel = /\b(cancel|cancelled|call off)\b/.test(t) || /取消/.test(raw);
  const wantsSchedule =
    /\b(schedule|my lessons|upcoming|what.?s on|existing lesson|all the (existing )?schedule|what do i have)\b/.test(t) ||
    /课表|行程/.test(raw);

  if (wantsEmail) {
    const client = findClient(ctx.clients, raw);
    if (!client) return { ok: false, error: "Name the student on the lesson to email." };
    const lesson = nextLessonForClient(ctx.lessons, client.id);
    if (!lesson) return { ok: false, error: "No upcoming confirmed lesson for " + client.name + " to email about." };
    const rest = raw.replace(new RegExp("(?:email|message|tell|remind)\\s+" + client.name.split(" ")[0], "i"), "").trim();
    const body = emailDraft(lesson, rest.replace(client.name, "").trim());
    return { ok: true, needsConfirm: true, action: { type: "draft_email", lessonId: lesson.id, body }, summary: "Email " + client.name + " about their lesson." };
  }

  if (wantsSwap) {
    const named = findNamedClients(ctx.clients, raw);
    if (named.length < 2) return { ok: false, error: "Name the two students to swap, like swap Emma and Jordan." };
    const a = nextLessonForClient(ctx.lessons, named[0].id);
    const b = nextLessonForClient(ctx.lessons, named[1].id);
    if (!a || !b) return { ok: false, error: "Both students need an upcoming confirmed lesson to swap." };
    if (a.id === b.id) return { ok: false, error: "Pick two different students." };
    const note = clipSwapNote(raw, named.map((c) => c.name));
    return {
      ok: true,
      needsConfirm: true,
      action: { type: "draft_swap", lessonAId: a.id, lessonBId: b.id, note },
      summary: "Ask " + named[0].name.split(" ")[0] + " and " + named[1].name.split(" ")[0] + " to swap times.",
    };
  }

  if (wantsCancel) {
    const lesson = lessonForCancel(ctx.lessons, raw, ctx.todayKey, ctx.timezone);
    if (!lesson) {
      return { ok: true, needsConfirm: false, action: { type: "list_lessons" }, summary: "Which lesson should I cancel? Here's what's coming up." };
    }
    return {
      ok: true,
      needsConfirm: true,
      action: { type: "cancel_lesson", lessonId: lesson.id },
      summary: "Cancel the lesson with " + lesson.clientName + ".",
    };
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
    const start = zonedInstant(dateKey, hour * 60 + min, ctx.timezone);
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

  if (wantsSchedule) {
    return { ok: true, needsConfirm: false, action: { type: "list_lessons" }, summary: "Here's the upcoming schedule." };
  }

  return { ok: true, needsConfirm: false, action: { type: "list_lessons" }, summary: "Here's the upcoming schedule. Tell me what to change." };
}

function clipSwapNote(raw: string, names: string[]) {
  let note = raw.replace(/\b(swap|switch|trade|please|can you|could you|对调|换课)\b/gi, " ");
  for (const n of names) {
    note = note.replace(new RegExp(n.split(" ")[0], "ig"), " ");
    note = note.replace(new RegExp(n, "ig"), " ");
  }
  note = note.replace(/\band\b/gi, " ").replace(/\s+/g, " ").trim();
  if (note.length < 3) return "Please swap these two lesson times.";
  return note.slice(0, 400);
}
