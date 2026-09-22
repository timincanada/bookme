import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { coachListConversations } from "@/lib/bookme/messages-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/messages/")({ component: CoachInbox });

type Threads = Extract<Awaited<ReturnType<typeof coachListConversations>>, { ok: true }>["threads"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function rowTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CoachInbox() {
  const [threads, setThreads] = useState<Threads | null>(null);

  useEffect(() => {
    coachListConversations().then((r) => setThreads(r.ok ? r.threads : []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-3xl font-medium">Messages</h1>
      {!threads ? <p className="mt-6 text-muted">Loading…</p> : null}
      {threads && threads.length === 0 ? (
        <p className="mt-6 text-muted">No conversations yet. Start one from a client's page.</p>
      ) : null}
      {threads && threads.length > 0 ? (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
          {threads.map((t) => (
            <li key={t.clientId}>
              <Link
                to="/app/messages/$clientId"
                params={{ clientId: t.clientId }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-paper"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-2 text-sm font-semibold text-forest">
                  {initials(t.clientName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={cn("truncate", t.unread ? "font-semibold" : "font-medium")}>
                      {t.clientName}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{rowTime(t.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {t.lastPreview || "No messages yet"}
                    {t.mode === "read" ? " · Read-only" : ""}
                  </span>
                </span>
                {t.unread ? (
                  <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-semibold text-on-forest">
                    {t.unread > 9 ? "9+" : t.unread}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
