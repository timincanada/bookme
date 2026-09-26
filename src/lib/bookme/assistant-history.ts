/**
 * Assistant thread persistence helpers.
 * Pure validation, context window, and SQL against a caller-supplied query
 * surface so unit tests do not open a database. Server functions live in api.ts.
 */

export const ASSISTANT_TEXT_MAX = 4000;
export const ASSISTANT_CARD_MAX_BYTES = 20_000;
export const ASSISTANT_APPEND_MAX = 20;
export const ASSISTANT_LIST_LIMIT = 100;
export const ASSISTANT_PRUNE_KEEP = 500;
export const ASSISTANT_CONTEXT_MAX_MESSAGES = 10;
export const ASSISTANT_CONTEXT_MAX_CHARS = 4000;
export const ASSISTANT_VOICE_CONTEXT_MAX_CHARS = 1500;

const CLIENT_ID_RE = /^[0-9a-zA-Z_-]{1,80}$/;

export type AssistantHistoryRole = "user" | "assistant";
export type AssistantHistorySource = "text" | "voice";

export type NormalizedAssistantItem = {
  id: string | null;
  role: AssistantHistoryRole;
  text: string;
  card: Record<string, unknown> | null;
  source: AssistantHistorySource | null;
};

export type StoredAssistantMessage = {
  id: string;
  role: AssistantHistoryRole;
  text: string;
  card: Record<string, unknown> | null;
  source: AssistantHistorySource | null;
  createdAt: string;
};

export type AssistantContextMessage = {
  role: AssistantHistoryRole;
  content: string;
};

export type SqlQuery = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

type ValidateResult = { ok: true; items: NormalizedAssistantItem[] } | { ok: false; error: string };

export function trimAssistantText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, ASSISTANT_TEXT_MAX);
}

function asRole(value: unknown): AssistantHistoryRole | null {
  return value === "user" || value === "assistant" ? value : null;
}

function asSource(value: unknown): AssistantHistorySource | null {
  return value === "text" || value === "voice" ? value : null;
}

function asIso(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString();
}

function parseCardValue(value: unknown): { ok: true; card: Record<string, unknown> | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, card: null };
  let obj: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { ok: true, card: null };
    if (trimmed.length > ASSISTANT_CARD_MAX_BYTES) return { ok: false, error: "Card is too large." };
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: "Invalid card." };
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, error: "Invalid card." };
  let json: string;
  try {
    json = JSON.stringify(obj);
  } catch {
    return { ok: false, error: "Invalid card." };
  }
  if (new TextEncoder().encode(json).length > ASSISTANT_CARD_MAX_BYTES) return { ok: false, error: "Card is too large." };
  return { ok: true, card: obj as Record<string, unknown> };
}

/** Copy append input into a shallow shape guardInput can accept (card as a JSON string). */
export function flattenAssistantAppend(input: unknown): { items: unknown[] } {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { items?: unknown }).items
      : undefined;
  if (!Array.isArray(raw)) return { items: [] };
  return {
    items: raw.slice(0, ASSISTANT_APPEND_MAX + 1).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const row = item as Record<string, unknown>;
      return {
        clientId: row.clientId,
        role: row.role,
        text: row.text,
        source: row.source,
        card: cardJsonForGuard(row.card),
      };
    }),
  };
}

function cardJsonForGuard(card: unknown): string | null {
  if (card == null || card === "") return null;
  try {
    const json = typeof card === "string" ? card.trim() : JSON.stringify(card);
    if (!json || json === "null" || json === "[]") return null;
    if (json.length > ASSISTANT_CARD_MAX_BYTES) return null;
    if (json[0] !== "{") return null;
    return json;
  } catch {
    return null;
  }
}

export function validateAssistantAppend(items: unknown): ValidateResult {
  if (!Array.isArray(items)) return { ok: false, error: "Expected a list of messages." };
  if (items.length < 1) return { ok: false, error: "No messages to save." };
  if (items.length > ASSISTANT_APPEND_MAX) return { ok: false, error: "Too many messages." };
  const out: NormalizedAssistantItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid message." };
    const item = raw as Record<string, unknown>;
    const role = asRole(item.role);
    if (!role) return { ok: false, error: "Invalid role." };
    if (item.text != null && typeof item.text !== "string") return { ok: false, error: "Invalid text." };
    const text = String(item.text ?? "")
      .replace(/\u0000/g, "")
      .trim();
    if (text.length > ASSISTANT_TEXT_MAX) return { ok: false, error: "Message is too long." };
    const card = parseCardValue(item.card);
    if (!card.ok) return card;
    if (!text && !card.card) return { ok: false, error: "Message is empty." };
    let source: AssistantHistorySource | null = null;
    if (item.source != null && item.source !== "") {
      source = asSource(item.source);
      if (!source) return { ok: false, error: "Invalid source." };
    }
    let id: string | null = null;
    if (item.clientId != null && item.clientId !== "") {
      const clientId = String(item.clientId).trim();
      if (!CLIENT_ID_RE.test(clientId)) return { ok: false, error: "Invalid message id." };
      id = clientId;
    }
    out.push({ id, role, text, card: card.card, source });
  }
  return { ok: true, items: out };
}

/**
 * Newest messages that fit in the char budget. Older messages are dropped.
 * A trailing user row whose text equals `dropTrailingUserText` is removed so
 * the current turn is not sent twice.
 */
export function windowAssistantContext(
  rows: { role: string; text: string }[],
  opts?: { maxMessages?: number; maxChars?: number; dropTrailingUserText?: string },
): AssistantContextMessage[] {
  const maxMessages = opts?.maxMessages ?? ASSISTANT_CONTEXT_MAX_MESSAGES;
  const maxChars = opts?.maxChars ?? ASSISTANT_CONTEXT_MAX_CHARS;
  const drop = String(opts?.dropTrailingUserText ?? "").trim();
  const usable: { role: AssistantHistoryRole; text: string }[] = [];
  for (const row of rows) {
    const role = asRole(row.role);
    if (!role) continue;
    const text = String(row.text ?? "").trim();
    if (!text) continue;
    usable.push({ role, text });
  }
  if (drop && usable.length) {
    const last = usable[usable.length - 1]!;
    if (last.role === "user" && last.text === drop) usable.pop();
  }
  const picked: AssistantContextMessage[] = [];
  let used = 0;
  for (let i = usable.length - 1; i >= 0; i--) {
    if (picked.length >= maxMessages) break;
    const text = usable[i]!.text;
    const room = maxChars - used;
    if (room <= 0) break;
    if (text.length > room) {
      if (picked.length === 0) {
        const slice = text.slice(0, room).trim();
        if (slice) picked.push({ role: usable[i]!.role, content: slice });
      }
      break;
    }
    used += text.length;
    picked.push({ role: usable[i]!.role, content: text });
  }
  picked.reverse();
  return picked;
}

/** Short prior-turn blurb for the realtime session instructions. Empty when there is nothing to say. */
export function assistantVoiceContext(
  rows: { role: string; text: string }[],
  maxChars = ASSISTANT_VOICE_CONTEXT_MAX_CHARS,
): string {
  const cap = Math.max(0, maxChars);
  if (!cap) return "";
  const turns = windowAssistantContext(rows, { maxMessages: 8, maxChars: cap });
  if (!turns.length) return "";
  const lines = turns.map(
    (turn) => (turn.role === "user" ? "Coach: " : "Assistant: ") + turn.content.replace(/\s+/g, " ").trim(),
  );
  const prefix = "Recent conversation: ";
  const kept: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const next = [lines[i]!, ...kept];
    if ((prefix + next.join(" | ")).length > cap) {
      if (!kept.length) return (prefix + lines[i]!).slice(0, cap).trim();
      break;
    }
    kept.unshift(lines[i]!);
  }
  return (prefix + kept.join(" | ")).slice(0, cap);
}

/** system, then prior turns, then the new user message. No history → [system, user]. */
export function buildModelMessages(
  system: string,
  history: { role: string; content: string }[] | undefined,
  userMessage: string,
): { role: "system" | AssistantHistoryRole; content: string }[] {
  const prior = windowAssistantContext(
    (history ?? []).map((message) => ({ role: message.role, text: message.content })),
    {
      maxMessages: ASSISTANT_CONTEXT_MAX_MESSAGES,
      maxChars: ASSISTANT_CONTEXT_MAX_CHARS,
      dropTrailingUserText: userMessage,
    },
  );
  return [
    { role: "system", content: system },
    ...prior.map((message) => ({ role: message.role, content: message.content })),
    { role: "user", content: userMessage },
  ];
}

function parseStoredCard(value: unknown): Record<string, unknown> | null {
  const parsed = parseCardValue(value);
  return parsed.ok ? parsed.card : null;
}

export async function listAssistantMessagesForCoach(sql: SqlQuery, coachId: string): Promise<StoredAssistantMessage[]> {
  const rows = await sql.query<{
    id: string;
    role: string;
    text: string;
    card: unknown;
    source: string | null;
    created_at: string | Date;
  }>(
    `select id, role, text, card, source, created_at
     from (
       select id, role, text, card, source, created_at
       from assistant_messages
       where coach_id = $1
       order by created_at desc, id desc
       limit ${ASSISTANT_LIST_LIMIT}
     ) recent
     order by created_at asc, id asc`,
    [coachId],
  );
  const out: StoredAssistantMessage[] = [];
  for (const row of rows) {
    const role = asRole(row.role);
    if (!role) continue;
    out.push({
      id: String(row.id),
      role,
      text: String(row.text ?? ""),
      card: parseStoredCard(row.card),
      source: asSource(row.source),
      createdAt: asIso(row.created_at),
    });
  }
  return out;
}

export async function appendAssistantMessagesForCoach(
  sql: SqlQuery,
  coachId: string,
  items: unknown,
  now = Date.now(),
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = validateAssistantAppend(items);
  if (!parsed.ok) return parsed;
  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i]!;
    const id = item.id || crypto.randomUUID();
    await sql.query(
      `insert into assistant_messages (id, coach_id, role, text, card, source, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)
       on conflict (id) do update set
         text = excluded.text,
         card = excluded.card,
         source = coalesce(excluded.source, assistant_messages.source)
       where assistant_messages.coach_id = excluded.coach_id`,
      [id, coachId, item.role, item.text, item.card ? JSON.stringify(item.card) : null, item.source, new Date(now + i).toISOString()],
    );
  }
  await sql.query(
    `delete from assistant_messages
     where coach_id = $1
       and id in (
         select id from assistant_messages
         where coach_id = $1
         order by created_at desc, id desc
         offset ${ASSISTANT_PRUNE_KEEP}
       )`,
    [coachId],
  );
  return { ok: true, count: parsed.items.length };
}

export async function clearAssistantMessagesForCoach(sql: SqlQuery, coachId: string): Promise<void> {
  await sql.query(`delete from assistant_messages where coach_id = $1`, [coachId]);
}

export async function loadAssistantModelHistory(
  sql: SqlQuery,
  coachId: string,
  currentUserText: string,
): Promise<AssistantContextMessage[]> {
  const rows = await sql.query<{ role: string; text: string }>(
    `select role, text
     from (
       select role, text, created_at, id
       from assistant_messages
       where coach_id = $1
       order by created_at desc, id desc
       limit ${ASSISTANT_CONTEXT_MAX_MESSAGES + 2}
     ) recent
     order by created_at asc, id asc`,
    [coachId],
  );
  return windowAssistantContext(rows, { dropTrailingUserText: currentUserText });
}
