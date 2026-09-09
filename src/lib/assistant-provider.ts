import {
  parseAssistant,
  type AssistantAction,
  type Capability,
  type ClientHit,
  type LessonHit,
} from "./assistant";

export type AssistantChatContext = {
  todayKey: string;
  clients: ClientHit[];
  lessons: LessonHit[];
};

export type AssistantChatInput = {
  coachId: string;
  message: string;
  capabilities: Capability[];
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

const WRITE_TYPES = new Set(["draft_email", "draft_reschedule"]);

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

  return null;
}

function buildSystemPrompt(input: AssistantChatInput): string {
  const caps = input.capabilities.join(", ") || "(none)";
  const clients = input.context.clients
    .slice(0, 40)
    .map((c) => `${c.id}:${c.name}`)
    .join("; ");
  const lessons = input.context.lessons
    .slice(0, 40)
    .map((l) => `${l.id}|${l.clientId}|${l.clientName}|${l.startAt}|${l.status}|${l.location || ""}`)
    .join("\n");
  return [
    "You are a coach scheduling assistant for BookMe.",
    "Reply with a single JSON object only (no markdown).",
    "Schema: { \"text\": string, \"summary\"?: string, \"action\"?: AssistantAction, \"needsConfirm\"?: boolean, \"error\"?: string }",
    "AssistantAction is one of:",
    '{ "type":"list_availability", "dateKey":"YYYY-MM-DD", "days":1|7 }',
    '{ "type":"draft_email", "lessonId": string, "body": string }',
    '{ "type":"draft_reschedule", "op":"move", "lessonId": string, "start": ISO-8601 }',
    '{ "type":"draft_reschedule", "op":"block", "dateKey":"YYYY-MM-DD", "startMin": number, "endMin": number }',
    "Rules:",
    "- Only use these capabilities: " + caps,
    "- list_availability is read-only; set needsConfirm false.",
    "- draft_email and draft_reschedule must set needsConfirm true. Never claim they were sent or applied.",
    "- draft_email must use a lessonId from the lesson list (student email is on that lesson).",
    "- draft_reschedule move must use a lessonId from the list and an ISO start time.",
    "- If you cannot help, return { \"error\": \"...\" } with a short reason.",
    "- Do not invent lesson or client ids.",
    "Today (coach timezone date key): " + input.context.todayKey,
    "Clients: " + (clients || "(none)"),
    "Lessons (id|clientId|name|startAt|status|location):",
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

export function resolveAssistantProvider(name = envName()): AssistantProvider {
  if (name === "deepseek") return deepseekProvider;
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
