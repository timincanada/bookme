import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MESSAGE_MAX_LENGTH } from "@/lib/bookme/messages";
import { cn } from "@/lib/utils";

type Item = { id: string; role: "coach" | "student"; body: string; createdAt: string };
type Page =
  | {
      ok: true;
      thread: { mode: "send" | "read" | "none"; note: string; otherName: string };
      messages: Item[];
      cursor: string | null;
    }
  | { ok: false; error: string };

const POLL_MS = 5000;

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Enter sends on a fine pointer (desktop). Touch keyboards insert a newline. */
function desktopEnterSends() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return (
    window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(pointer: coarse)").matches
  );
}

/** Grow a one-line composer up to five lines, then scroll inside the field. */
function fitComposer(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const cs = getComputedStyle(el);
  const line = Number.parseFloat(cs.lineHeight) || 24;
  const pad = (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
  const border =
    (Number.parseFloat(cs.borderTopWidth) || 0) + (Number.parseFloat(cs.borderBottomWidth) || 0);
  const min = line + pad + border;
  const max = line * 5 + pad + border;
  el.style.height = "0px";
  const needed = el.scrollHeight + border;
  const next = Math.max(min, Math.min(needed, max));
  el.style.height = `${next}px`;
  el.style.overflowY = needed > max + 1 ? "auto" : "hidden";
}

/** Conversation view shared by the student portal and the coach app. */
export function MessageThread({
  viewer,
  load,
  send,
  markRead,
  banner,
  layout = "card",
  leading,
  trailing,
}: {
  viewer: "coach" | "student";
  load: (after: string | null) => Promise<Page>;
  send: (body: string) => Promise<{ ok: true; message: Item } | { ok: false; error: string }>;
  markRead: () => Promise<unknown>;
  /** Shown under the name and above the first bubble (booking / swap cards). */
  banner?: ReactNode;
  /** `chat` is the coach thread (full-height). Default keeps the card layout. */
  layout?: "card" | "chat";
  /** Chat layout: back control at the start of the header row. */
  leading?: ReactNode;
  /** Chat layout: trailing control (Client link) on the header row. */
  trailing?: ReactNode;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [thread, setThread] = useState<Extract<Page, { ok: true }>["thread"] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const cursor = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottom = useRef(true);
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
    if (layout === "chat") {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      stickToBottom.current = true;
      return;
    }
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items.length, layout]);

  useEffect(() => {
    if (layout !== "chat") return;
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout, thread?.mode]);

  useEffect(() => {
    if (layout !== "chat") return;
    fitComposer(composerRef.current);
  }, [draft, layout, thread?.mode]);

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

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.repeat) return;
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (!desktopEnterSends()) return;
    e.preventDefault();
    void submit();
  }

  const failed = Boolean(error) && !thread;
  const nearLimit = MESSAGE_MAX_LENGTH - draft.length <= 200;

  if (layout === "chat") {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-paper">
        <div className="flex shrink-0 items-center gap-1 border-b border-line bg-paper px-1 py-1">
          {leading}
          <p
            className="min-w-0 flex-1 truncate text-base font-semibold text-ink"
            title={thread?.otherName || undefined}
          >
            {thread?.otherName ?? ""}
          </p>
          {trailing}
        </div>
        {banner ? <div className="shrink-0">{banner}</div> : null}
        {failed ? <p className="min-h-0 flex-1 p-4 text-sm text-muted">{error}</p> : null}
        {!thread && !failed ? (
          <p className="min-h-0 flex-1 p-4 text-sm text-muted">Loading…</p>
        ) : null}
        {thread ? (
          <>
            <ol
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 py-3"
              aria-live="polite"
              onScroll={(e) => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
            >
              {items.length === 0 ? <li className="text-sm text-muted">No messages yet.</li> : null}
              {items.map((m) => {
                const mine = m.role === viewer;
                return (
                  <li
                    key={m.id}
                    className={cn("flex min-w-0 flex-col", mine ? "items-end" : "items-start")}
                  >
                    <p
                      className={cn(
                        "w-fit min-w-0 max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ![overflow-wrap:anywhere]",
                        mine
                          ? "rounded-br-md bg-forest text-on-forest"
                          : "rounded-bl-md bg-paper-2 text-ink",
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
            </ol>
            {thread.mode === "send" ? (
              <form
                className="shrink-0 border-t border-line bg-paper px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {nearLimit ? (
                  <p className="mb-1 text-right text-[11px] text-muted">
                    {draft.length}/{MESSAGE_MAX_LENGTH}
                  </p>
                ) : null}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={composerRef}
                    rows={1}
                    className="max-h-40 min-h-10 w-full flex-1 resize-none rounded-3xl border border-line bg-card px-4 py-2 text-[16px] leading-6 text-ink outline-none placeholder:text-muted focus:border-forest"
                    value={draft}
                    maxLength={MESSAGE_MAX_LENGTH}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      fitComposer(e.target);
                    }}
                    onKeyDown={onComposerKeyDown}
                    placeholder={`Message ${thread.otherName}…`}
                    aria-label="Message"
                  />
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={busy || !draft.trim()}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-on-forest hover:bg-forest-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 disabled:opacity-40"
                  >
                    <ArrowUp className="size-5" strokeWidth={2} aria-hidden />
                  </button>
                </div>
                {error ? <p className="mt-2 text-sm text-coral">{error}</p> : null}
              </form>
            ) : (
              <p className="shrink-0 border-t border-line bg-paper p-4 text-sm text-muted">
                {thread.note || "This conversation is read-only."}
              </p>
            )}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col rounded-2xl bg-card ring-1 ring-line">
      {thread ? (
        <div className="border-b border-line px-4 py-3">
          <p className="font-semibold">{thread.otherName}</p>
        </div>
      ) : null}
      {banner}
      {failed ? <p className="p-4 text-sm text-muted">{error}</p> : null}
      {!thread && !failed ? <p className="p-4 text-sm text-muted">Loading…</p> : null}
      {thread ? (
        <>
          <ol className="max-h-[60vh] min-h-48 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {items.length === 0 ? <li className="text-sm text-muted">No messages yet.</li> : null}
            {items.map((m) => {
              const mine = m.role === viewer;
              return (
                <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  <p
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      mine
                        ? "rounded-br-md bg-forest text-on-forest"
                        : "rounded-bl-md bg-paper-2 text-ink",
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
            <p className="border-t border-line p-4 text-sm text-muted">
              {thread.note || "This conversation is read-only."}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
