import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MESSAGE_MAX_LENGTH } from "@/lib/bookme/messages";
import { cn } from "@/lib/utils";

type Item = { id: string; role: "coach" | "student"; body: string; createdAt: string };
type Page =
  | { ok: true; thread: { mode: "send" | "read" | "none"; note: string; otherName: string }; messages: Item[]; cursor: string | null }
  | { ok: false; error: string };

const POLL_MS = 5000;

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Conversation view shared by the student portal and the coach app. */
export function MessageThread({
  viewer,
  load,
  send,
  markRead,
}: {
  viewer: "coach" | "student";
  load: (after: string | null) => Promise<Page>;
  send: (body: string) => Promise<{ ok: true; message: Item } | { ok: false; error: string }>;
  markRead: () => Promise<unknown>;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [thread, setThread] = useState<Extract<Page, { ok: true }>["thread"] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const cursor = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const loadRef = useRef(load);
  const readRef = useRef(markRead);
  loadRef.current = load;
  readRef.current = markRead;

  useEffect(() => {
    let alive = true;
    async function pull(first: boolean) {
      const page = await loadRef.current(first ? null : cursor.current);
      if (!alive) return;
      if (!page.ok) {
        setError(page.error);
        return;
      }
      setThread(page.thread);
      cursor.current = page.cursor;
      if (page.messages.length || first) {
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...(first ? [] : prev), ...page.messages.filter((m) => first || !seen.has(m.id))];
        });
        void readRef.current();
      }
    }
    void pull(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void pull(false);
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  async function submit() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    const res = await send(body);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDraft("");
    setItems((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
  }

  if (error && !thread) return <p className="mt-6 text-muted">{error}</p>;
  if (!thread) return <p className="mt-6 text-muted">Loading…</p>;

  return (
    <div className="mt-4 flex flex-col rounded-2xl bg-card ring-1 ring-line">
      <ol className="max-h-[60vh] min-h-48 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {items.length === 0 ? <li className="text-sm text-muted">No messages yet.</li> : null}
        {items.map((m) => {
          const mine = m.role === viewer;
          return (
            <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  mine ? "rounded-br-md bg-forest text-on-forest" : "rounded-bl-md bg-paper-2 text-ink",
                )}
              >
                {m.body}
              </p>
              <span className="mt-1 px-1 text-[11px] text-muted">
                {mine ? "You" : thread.otherName} · {stamp(m.createdAt)}
              </span>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>
      {thread.mode === "send" ? (
        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <textarea
            className="field h-24 py-3"
            value={draft}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${thread.otherName}…`}
            aria-label="Message"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {draft.length}/{MESSAGE_MAX_LENGTH}
            </span>
            <Button type="submit" size="field" disabled={busy || !draft.trim()}>
              Send
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-coral">{error}</p> : null}
        </form>
      ) : (
        <p className="border-t border-line p-4 text-sm text-muted">{thread.note || "This conversation is read-only."}</p>
      )}
    </div>
  );
}
