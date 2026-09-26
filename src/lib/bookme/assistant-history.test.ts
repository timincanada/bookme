import assert from "node:assert/strict";
import {
  ASSISTANT_APPEND_MAX,
  ASSISTANT_CARD_MAX_BYTES,
  ASSISTANT_CONTEXT_MAX_CHARS,
  ASSISTANT_CONTEXT_MAX_MESSAGES,
  ASSISTANT_LIST_LIMIT,
  ASSISTANT_PRUNE_KEEP,
  ASSISTANT_TEXT_MAX,
  ASSISTANT_VOICE_CONTEXT_MAX_CHARS,
  appendAssistantMessagesForCoach,
  assistantVoiceContext,
  buildModelMessages,
  clearAssistantMessagesForCoach,
  flattenAssistantAppend,
  listAssistantMessagesForCoach,
  loadAssistantModelHistory,
  trimAssistantText,
  validateAssistantAppend,
  windowAssistantContext,
  type SqlQuery,
} from "./assistant-history.ts";

function item(overrides: Record<string, unknown> = {}) {
  return { clientId: "msg-1", role: "user", text: "Hello", source: "text", ...overrides };
}

const valid = validateAssistantAppend([item()]);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.items.length, 1);
  assert.equal(valid.items[0]!.id, "msg-1");
  assert.equal(valid.items[0]!.role, "user");
  assert.equal(valid.items[0]!.text, "Hello");
  assert.equal(valid.items[0]!.source, "text");
  assert.equal(valid.items[0]!.card, null);
}

const trimmed = validateAssistantAppend([item({ text: "  hi there  ", clientId: "", source: null })]);
assert.equal(trimmed.ok, true);
if (trimmed.ok) {
  assert.equal(trimmed.items[0]!.text, "hi there");
  assert.equal(trimmed.items[0]!.id, null);
  assert.equal(trimmed.items[0]!.source, null);
}

assert.equal(trimAssistantText("  " + "a".repeat(ASSISTANT_TEXT_MAX + 25) + "  ").length, ASSISTANT_TEXT_MAX);

const tooLong = validateAssistantAppend([item({ text: "x".repeat(ASSISTANT_TEXT_MAX + 1) })]);
assert.equal(tooLong.ok, false);
if (!tooLong.ok) assert.equal(tooLong.error, "Message is too long.");

const badRole = validateAssistantAppend([item({ role: "system" })]);
assert.equal(badRole.ok, false);
if (!badRole.ok) assert.equal(badRole.error, "Invalid role.");

const badSource = validateAssistantAppend([item({ source: "phone" })]);
assert.equal(badSource.ok, false);
if (!badSource.ok) assert.equal(badSource.error, "Invalid source.");

const badId = validateAssistantAppend([item({ clientId: "has space" })]);
assert.equal(badId.ok, false);
if (!badId.ok) assert.equal(badId.error, "Invalid message id.");

assert.equal(validateAssistantAppend([]).ok, false);
assert.equal(validateAssistantAppend({ items: [] }).ok, false);
assert.equal(validateAssistantAppend(Array.from({ length: ASSISTANT_APPEND_MAX + 1 }, () => item())).ok, false);
assert.equal(validateAssistantAppend([item({ text: "   ", card: null })]).ok, false);

const card = validateAssistantAppend([item({ role: "assistant", text: "Openings", card: { kind: "openings", groups: [] } })]);
assert.equal(card.ok, true);
if (card.ok) assert.deepEqual(card.items[0]!.card, { kind: "openings", groups: [] });

const cardString = validateAssistantAppend([
  item({ role: "assistant", text: "Openings", card: JSON.stringify({ kind: "schedule" }) }),
]);
assert.equal(cardString.ok, true);
if (cardString.ok) assert.deepEqual(cardString.items[0]!.card, { kind: "schedule" });

const huge = { note: "n".repeat(ASSISTANT_CARD_MAX_BYTES + 50) };
const hugeCard = validateAssistantAppend([item({ role: "assistant", text: "Card", card: huge })]);
assert.equal(hugeCard.ok, false);
if (!hugeCard.ok) assert.equal(hugeCard.error, "Card is too large.");

const flat = flattenAssistantAppend({
  items: [item({ card: huge }), item({ clientId: "msg-2", text: "Kept", card: { kind: "openings" } }), "nope"],
});
assert.equal(flat.items.length, 3);
assert.equal((flat.items[0] as { card: string | null }).card, null);
assert.equal((flat.items[1] as { card: string | null }).card, JSON.stringify({ kind: "openings" }));

const turns = [
  { role: "user", text: "first" },
  { role: "assistant", text: "second" },
  { role: "user", text: "third" },
  { role: "system", text: "ignore" },
  { role: "assistant", text: "   " },
];
assert.deepEqual(
  windowAssistantContext(turns, { maxMessages: 10, maxChars: 4000 }),
  [
    { role: "user", content: "first" },
    { role: "assistant", content: "second" },
    { role: "user", content: "third" },
  ],
);
assert.deepEqual(windowAssistantContext(turns, { dropTrailingUserText: " third " }), [
  { role: "user", content: "first" },
  { role: "assistant", content: "second" },
]);

const bulky = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: String(i).repeat(500) }));
const windowed = windowAssistantContext(bulky, {
  maxMessages: ASSISTANT_CONTEXT_MAX_MESSAGES,
  maxChars: ASSISTANT_CONTEXT_MAX_CHARS,
});
assert.equal(windowed.length <= ASSISTANT_CONTEXT_MAX_MESSAGES, true);
assert.equal(
  windowed.reduce((sum, message) => sum + message.content.length, 0) <= ASSISTANT_CONTEXT_MAX_CHARS,
  true,
);
assert.equal(windowed[windowed.length - 1]!.content, bulky[bulky.length - 1]!.text);
assert.equal(windowed.some((message) => message.content === bulky[0]!.text), false);

const voice = assistantVoiceContext([
  { role: "user", text: "What's on tomorrow?" },
  { role: "assistant", text: "Two lessons." },
]);
assert.equal(voice.startsWith("Recent conversation:"), true);
assert.equal(voice.includes("Coach: What's on tomorrow?"), true);
assert.equal(voice.includes("Assistant: Two lessons."), true);
assert.equal(voice.length <= ASSISTANT_VOICE_CONTEXT_MAX_CHARS, true);

const longVoice = assistantVoiceContext(
  Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "word ".repeat(80) + i })),
);
assert.equal(longVoice.length <= ASSISTANT_VOICE_CONTEXT_MAX_CHARS, true);
assert.equal(longVoice.includes("19") || longVoice.length === ASSISTANT_VOICE_CONTEXT_MAX_CHARS, true);
assert.equal(assistantVoiceContext([]), "");

const bare = buildModelMessages("SYSTEM", undefined, "Openings this week");
assert.deepEqual(bare, [
  { role: "system", content: "SYSTEM" },
  { role: "user", content: "Openings this week" },
]);
const withHistory = buildModelMessages(
  "SYSTEM",
  [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello" },
    { role: "user", content: "Openings this week" },
  ],
  "Openings this week",
);
assert.deepEqual(withHistory, [
  { role: "system", content: "SYSTEM" },
  { role: "user", content: "Hi" },
  { role: "assistant", content: "Hello" },
  { role: "user", content: "Openings this week" },
]);

type Call = { text: string; params: unknown[] };

function fakeSql(rows: Record<string, unknown>[] = []): SqlQuery & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      calls.push({ text, params });
      return rows as T[];
    },
  };
}

async function main() {
  const listed = fakeSql([
    {
      id: "b",
      role: "assistant",
      text: "Hi",
      card: { kind: "openings" },
      source: "text",
      created_at: new Date("2026-09-25T15:00:00.000Z"),
    },
  ]);
  const messages = await listAssistantMessagesForCoach(listed, "coach-1");
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.createdAt, "2026-09-25T15:00:00.000Z");
  assert.deepEqual(messages[0]!.card, { kind: "openings" });
  assert.match(listed.calls[0]!.text, /where coach_id = \$1/);
  assert.match(listed.calls[0]!.text, new RegExp(`limit ${ASSISTANT_LIST_LIMIT}`));
  assert.match(listed.calls[0]!.text, /order by created_at asc, id asc/);
  assert.deepEqual(listed.calls[0]!.params, ["coach-1"]);

  const saved = fakeSql();
  const appended = await appendAssistantMessagesForCoach(
    saved,
    "coach-1",
    [item({ clientId: "", text: " Hello " }), item({ clientId: "msg-2", role: "assistant", text: "Hi", source: "voice", card: { kind: "schedule" } })],
    Date.UTC(2026, 8, 25, 15, 0, 0),
  );
  assert.deepEqual(appended, { ok: true, count: 2 });
  assert.match(saved.calls[0]!.params[0] as string, /^[0-9a-f-]{36}$/);
  assert.equal(saved.calls[0]!.params[1], "coach-1");
  assert.equal(saved.calls[0]!.params[3], "Hello");
  assert.equal(saved.calls[0]!.params[6], "2026-09-25T15:00:00.000Z");
  assert.equal(saved.calls[1]!.params[0], "msg-2");
  assert.equal(saved.calls[1]!.params[4], JSON.stringify({ kind: "schedule" }));
  assert.equal(saved.calls[1]!.params[5], "voice");
  assert.equal(saved.calls[1]!.params[6], "2026-09-25T15:00:00.001Z");
  assert.match(saved.calls[2]!.text, new RegExp(`offset ${ASSISTANT_PRUNE_KEEP}`));
  assert.deepEqual(saved.calls[2]!.params, ["coach-1"]);

  const rejected = fakeSql();
  const failed = await appendAssistantMessagesForCoach(rejected, "coach-1", [item({ role: "tool" })]);
  assert.equal(failed.ok, false);
  assert.equal(rejected.calls.length, 0);

  const cleared = fakeSql();
  await clearAssistantMessagesForCoach(cleared, "coach-9");
  assert.match(cleared.calls[0]!.text, /delete from assistant_messages where coach_id = \$1/);
  assert.deepEqual(cleared.calls[0]!.params, ["coach-9"]);

  const historySql = fakeSql([
    { role: "user", text: "Earlier" },
    { role: "assistant", text: "Noted" },
    { role: "user", text: "Openings this week" },
  ]);
  const history = await loadAssistantModelHistory(historySql, "coach-1", "Openings this week");
  assert.deepEqual(history, [
    { role: "user", content: "Earlier" },
    { role: "assistant", content: "Noted" },
  ]);
  assert.deepEqual(historySql.calls[0]!.params, ["coach-1"]);

  console.log("assistant-history tests ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
