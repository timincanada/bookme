import {
  parseAssistant,
  type AssistantAction,
  type Capability,
  type ClientHit,
  type LessonHit,
} from "./assistant";
import { DEFAULT_ASSISTANT_NAME, normalizeAssistantName } from "./assistant-name";
import { isLessonDuration, isPaymentStatus, parseClock, type RecurringRuleInput } from "./recurring";
import { formatWhen } from "./time";

export type AssistantChatContext = {
  todayKey: string;
  timezone: string;
  clients: ClientHit[];
  lessons: LessonHit[];
};

export type AssistantChatInput = {
  coachId: string;
  message: string;
  capabilities: Capability[];
  assistantName?: string;
  context: AssistantChatContext;
};

export type AssistantChatResult =
  | {
      ok: true;
      text: string;
      action?: AssistantAction;
      needsConfirm?: boolean;
      summary?: string;
    }
  | { ok: false; error: string };

export type AssistantProvider = {
  name: string;
  configured(): boolean;
  chat(input: AssistantChatInput): Promise<AssistantChatResult>;
};

const WRITE_TYPES = new Set(["draft_email", "draft_reschedule", "draft_swap", "cancel_lesson", "draft_import"]);

/** Write ops always need confirm; list_availability never does. */
export function needsConfirmFor(action: AssistantAction | undefined): boolean {
  if (!action) return false;
  return WRITE_TYPES.has(action.type);
}

function localText(result: Extract<ReturnType<typeof parseAssistant>, { ok: true }>): string {
  return result.summary;
}

export const localProvider: AssistantProvider = {
  name: "local",
  configured() {
    return true;
  },
  async chat(input) {
    const parsed = parseAssistant(input.message, input.context);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return {
      ok: true,
      text: localText(parsed),
      action: parsed.action,
      needsConfirm: parsed.needsConfirm,
      summary: parsed.summary,
    };
  },
};

/** @deprecated Prefer resolveAssistantProvider().parse stays for older call sites / tests. */
export const assistantProvider = {
  parse: parseAssistant,
  local: localProvider,
};

function envName(): string {
  return String(process.env.ASSISTANT_PROVIDER || "local").trim().toLowerCase() || "local";
}

export function deepseekConfigured(): boolean {
  return Boolean(String(process.env.DEEPSEEK_API_KEY || "").trim());
}

function deepseekBaseUrl(): string {
  const raw = String(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim().replace(/\/$/, "");
  return raw || "https://api.deepseek.com";
}

function deepseekModel(): string {
  return String(process.env.DEEPSEEK_MODEL || "deepseek-chat").trim() || "deepseek-chat";
}

type ModelPayload = {
  text?: string;
  summary?: string;
  needsConfirm?: boolean;
  action?: unknown;
  error?: string;
};

function isIsoDateKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isIsoDateTime(s: string) {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/** Map model JSON to a known AssistantAction, or null if invalid. */
export function coerceAssistantAction(raw: unknown, capabilities: Capability[]): AssistantAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const type = String(a.type || "");
  if (!capabilities.includes(type as Capability)) return null;

  if (type === "list_availability") {
    const dateKey = String(a.dateKey || "");
    const days = Number(a.days);
    if (!isIsoDateKey(dateKey)) return null;
    if (days !== 1 && days !== 7) return null;
    return { type: "list_availability", dateKey, days };
  }

  if (type === "list_lessons") return { type: "list_lessons" };

  if (type === "draft_email") {
    const lessonId = String(a.lessonId || "");
    const body = String(a.body || "").trim();
    if (!lessonId || body.length < 2) return null;
    return { type: "draft_email", lessonId, body };
  }

  if (type === "draft_reschedule") {
    const op = String(a.op || "");
    if (op === "move") {
      const lessonId = String(a.lessonId || "");
      const start = String(a.start || "");
      if (!lessonId || !isIsoDateTime(start)) return null;
      return { type: "draft_reschedule", op: "move", lessonId, start: new Date(start).toISOString() };
    }
    if (op === "block") {
      const dateKey = String(a.dateKey || "");
      const startMin = Number(a.startMin);
      const endMin = Number(a.endMin);
      if (!isIsoDateKey(dateKey)) return null;
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
      return { type: "draft_reschedule", op: "block", dateKey, startMin, endMin };
    }
  }

  if (type === "draft_swap") {
    const lessonAId = String(a.lessonAId || "");
    const lessonBId = String(a.lessonBId || "");
    const note = String(a.note || "").trim();
    if (!lessonAId || !lessonBId || lessonAId === lessonBId) return null;
    return { type: "draft_swap", lessonAId, lessonBId, note: note || "Please swap these two lesson times." };
  }

  if (type === "cancel_lesson") {
    const lessonId = String(a.lessonId || "");
    if (!lessonId) return null;
    return { type: "cancel_lesson", lessonId };
  }

  if (type === "draft_import") {
    const rule = coerceImportRule(a);
    return rule ? { type: "draft_import", rule } : null;
  }

  return null;
}

/**
 * Model JSON → import rule. Shape only; the server validates everything again
 * (dates, 6-month span, durations, conflicts) before showing a confirm card.
 */
function coerceImportRule(a: Record<string, unknown>): RecurringRuleInput | null {
  const slotsRaw = Array.isArray(a.slots) ? a.slots : [];
  const slots: RecurringRuleInput["slots"] = [];
  for (const raw of slotsRaw.slice(0, 20)) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const weekday = Number(r.weekday);
    const startMin = parseClock(String(r.time || ""));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || startMin == null) return null;
    const duration = r.durationMin == null ? null : Number(r.durationMin);
    if (duration != null && !isLessonDuration(duration)) return null;
    slots.push({ weekday, startMin, durationMin: duration });
  }
  if (!slots.length) return null;
  const startDate = String(a.startDate || "");
  const endDate = String(a.endDate || "");
  if (!isIsoDateKey(startDate) || !isIsoDateKey(endDate)) return null;
  const everyWeeks = Number(a.everyWeeks ?? 1);
  if (everyWeeks !== 1 && everyWeeks !== 2) return null;
  const clientId = String(a.clientId || "").trim();
  const clientName = String(a.clientName || "").trim();
  const clientEmail = String(a.clientEmail || "").trim();
  const client: RecurringRuleInput["client"] = clientId
    ? { kind: "existing", id: clientId }
    : { kind: "new", name: clientName, email: clientEmail || null };
  if (client.kind === "new" && !client.name) return null;
  const payment: NonNullable<RecurringRuleInput["payment"]> = {};
  if (a.paymentStatus != null && a.paymentStatus !== "") {
    if (!isPaymentStatus(a.paymentStatus)) return null;
    payment.status = a.paymentStatus;
  }
  if (typeof a.paymentNote === "string" && a.paymentNote.trim()) payment.note = a.paymentNote;
  if (typeof a.splitRatio === "string" && a.splitRatio.trim()) payment.split = a.splitRatio;
  return {
    client,
    slots,
    startDate,
    endDate,
    intervalWeeks: everyWeeks,
    payment,
    notifyStudent: a.notifyStudent === true,
  };
}

function buildSystemPrompt(input: AssistantChatInput): string {
  const caps = input.capabilities.join(", ") || "(none)";
  const asst = normalizeAssistantName(input.assistantName || DEFAULT_ASSISTANT_NAME);
  const canImport = input.capabilities.includes("draft_import");
  const clients = input.context.clients
    .slice(0, canImport ? 200 : 40)
    .map((c) => `${c.id}:${c.name}`)
    .join("; ");
  const lessons = input.context.lessons
    .slice(0, 40)
    .map((l) => `${l.id}|${l.clientId}|${l.clientName}|${formatWhen(new Date(l.startAt), input.context.timezone)}|${l.status}|${l.location || ""}`)
    .join("\n");
  return [
    "You are " + asst + ", a coach scheduling assistant for BookMe.",
    "On screen you appear as " + asst + ". Student-facing emails are from the coach, never from you.",
    "Reply with a single JSON object only (no markdown).",
    "Schema: { \"text\": string, \"summary\"?: string, \"action\"?: AssistantAction, \"needsConfirm\"?: boolean, \"error\"?: string }",
    "AssistantAction is one of:",
    '{ "type":"list_availability", "dateKey":"YYYY-MM-DD", "days":1|7 }',
    '{ "type":"list_lessons" }',
    '{ "type":"draft_email", "lessonId": string, "body": string }',
    '{ "type":"draft_reschedule", "op":"move", "lessonId": string, "start": ISO-8601 }',
    '{ "type":"draft_reschedule", "op":"block", "dateKey":"YYYY-MM-DD", "startMin": number, "endMin": number }',
    '{ "type":"draft_swap", "lessonAId": string, "lessonBId": string, "note": string }',
    '{ "type":"cancel_lesson", "lessonId": string }',
    ...(canImport
      ? [
          '{ "type":"draft_import", "clientId"?: string, "clientName"?: string, "clientEmail"?: string, "slots": [{ "weekday": 0-6 (0=Sunday), "time": "HH:MM" (24h), "durationMin"?: 30|45|60|90|120 }], "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "everyWeeks": 1|2, "paymentStatus"?: "unpaid"|"pay_per_lesson"|"prepaid_package"|"monthly"|"split"|"outside_platform"|"settled", "paymentNote"?: string, "splitRatio"?: string, "notifyStudent"?: boolean }',
        ]
      : []),
    "Rules:",
    "- Only use these capabilities: " + caps,
    "- list_availability and list_lessons are read-only; set needsConfirm false.",
    "- draft_email, draft_reschedule, draft_swap, and cancel_lesson must set needsConfirm true. Never claim they were sent or applied.",
    "- draft_email must use a lessonId from the lesson list (student email is on that lesson).",
    "- draft_email body is from the coach. Sign the draft as the coach. Never sign as " + asst + ".",
    "- draft_reschedule move must use a lessonId from the list and an ISO start time.",
    "- draft_swap asks two students to swap their upcoming lesson times. Use two different lesson ids from the list.",
    "- cancel_lesson cancels a confirmed upcoming lesson and emails the student. Use it when they ask to cancel.",
    "- If they ask for the schedule, upcoming lessons, or what's booked, use list_lessons. Times in the list are already in the coach's time zone (" + input.context.timezone + ").",
    ...(canImport
      ? [
          "- draft_import records an existing student's regular weekly lessons (one or more weekday+time slots, every week or every 2 weeks). It needs: the student, every weekday and time, a start date (default today) and an end date. The end date may be at most 6 calendar months after the start; if they say something longer, use start + 6 months and say so. If the student or the end date is missing, ask in text and do not return an action.",
          "- For draft_import use clientId when the student is in the client list; otherwise clientName (and clientEmail if they gave one). Omit durationMin unless they gave a length. Times are wall-clock times in " + input.context.timezone + ". Omit payment fields they did not mention. notifyStudent is false unless they ask to tell the student.",
          "- draft_import never saves anything by itself. The app shows the exact lesson count and conflicts and waits for the coach to confirm.",
          "- Write text in the same language the coach used.",
        ]
      : []),
    "- Never say you cannot. Pick the closest action and confirm on screen.",
    "- Do not invent lesson or client ids.",
    "Today (coach timezone date key): " + input.context.todayKey,
    "Clients: " + (clients || "(none)"),
    "Lessons (id|clientId|name|when|status|location):",
    lessons || "(none)",
  ].join("\n");
}

function extractJsonObject(raw: string): ModelPayload | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as ModelPayload;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as ModelPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

export type DeepSeekFetch = typeof fetch;

export function createDeepSeekProvider(opts?: {
  fetchFn?: DeepSeekFetch;
  timeoutMs?: number;
}): AssistantProvider {
  const fetchFn = opts?.fetchFn || fetch;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "deepseek",
    configured() {
      return deepseekConfigured();
    },
    async chat(input) {
      if (!deepseekConfigured()) {
        return { ok: false, error: "Model not configured" };
      }
      const key = String(process.env.DEEPSEEK_API_KEY || "").trim();
      const url = deepseekBaseUrl() + "/chat/completions";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({
            model: deepseekModel(),
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: buildSystemPrompt(input) },
              { role: "user", content: input.message },
            ],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          await res.text().catch(() => "");
          return {
            ok: false,
            error: "Model request failed (" + res.status + ")",
          };
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data?.choices?.[0]?.message?.content;
        const payload = extractJsonObject(String(content || ""));
        if (!payload) return { ok: false, error: "Model returned an unreadable reply." };
        if (payload.error) return { ok: false, error: String(payload.error) };

        const action = coerceAssistantAction(payload.action, input.capabilities);
        const text = String(payload.text || payload.summary || "").trim();
        if (!action && !text) return { ok: false, error: "Model returned an empty reply." };

        const needsConfirm = action ? needsConfirmFor(action) : false;
        return {
          ok: true,
          text: text || (payload.summary ? String(payload.summary) : "Here is a draft."),
          summary: payload.summary ? String(payload.summary) : undefined,
          action: action || undefined,
          needsConfirm: action ? needsConfirm : undefined,
        };
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          error: aborted ? "Model request timed out" : "Model request failed",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const deepseekProvider = createDeepSeekProvider();

export function grokConfigured(): boolean {
  return Boolean(String(process.env.XAI_API_KEY || "").trim());
}

function grokModel(): string {
  return String(process.env.XAI_MODEL || "grok-4.5").trim() || "grok-4.5";
}

export function createGrokProvider(opts?: {
  fetchFn?: DeepSeekFetch;
  timeoutMs?: number;
}): AssistantProvider {
  const fetchFn = opts?.fetchFn || fetch;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "grok",
    configured() {
      return grokConfigured();
    },
    async chat(input) {
      if (!grokConfigured()) {
        return { ok: false, error: "Model not configured" };
      }
      const key = String(process.env.XAI_API_KEY || "").trim();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchFn("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({
            model: grokModel(),
            temperature: 0.2,
            max_tokens: 800,
            messages: [
              { role: "system", content: buildSystemPrompt(input) },
              { role: "user", content: input.message },
            ],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          await res.text().catch(() => "");
          return { ok: false, error: "Model request failed (" + res.status + ")" };
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data?.choices?.[0]?.message?.content;
        const payload = extractJsonObject(String(content || ""));
        if (!payload) return { ok: false, error: "Model returned an unreadable reply." };
        if (payload.error) return { ok: false, error: String(payload.error) };

        const action = coerceAssistantAction(payload.action, input.capabilities);
        const text = String(payload.text || payload.summary || "").trim();
        if (!action && !text) return { ok: false, error: "Model returned an empty reply." };

        const needsConfirm = action ? needsConfirmFor(action) : false;
        return {
          ok: true,
          text: text || (payload.summary ? String(payload.summary) : "Here is a draft."),
          summary: payload.summary ? String(payload.summary) : undefined,
          action: action || undefined,
          needsConfirm: action ? needsConfirm : undefined,
        };
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          error: aborted ? "Model request timed out" : "Model request failed",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const grokProvider = createGrokProvider();

export function resolveAssistantProvider(name = envName()): AssistantProvider {
  if (name === "deepseek") return deepseekProvider;
  if (name === "grok" || name === "xai") return grokProvider;
  return localProvider;
}

export function logAssistantFailure(fields: {
  coachId: string;
  provider: string;
  error: string;
}) {
  console.log(
    JSON.stringify({
      msg: "assistant_provider_failed",
      coachId: fields.coachId,
      provider: fields.provider,
      error: fields.error,
    }),
  );
}
