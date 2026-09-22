import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { coachListConversations } from "@/lib/bookme/messages-api";

export const Route = createFileRoute("/app/messages/")({ component: CoachInbox });

type Threads = Extract<Awaited<ReturnType<typeof coachListConversations>>, { ok: true }>["threads"];

function CoachInbox() {
  const [threads, setThreads] = useState<Threads | null>(null);

  useEffect(() => {
    coachListConversations().then((r) => setThreads(r.ok ? r.threads : []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="mt-3 font-display text-3xl font-medium">Messages</h1>
      <p className="mt-1 text-muted">Start a conversation from a client's page.</p>
      {!threads ? <p className="mt-6 text-muted">Loading…</p> : null}
      <ul className="mt-5 space-y-2">
        {threads?.map((t) => (
          <li key={t.clientId}>
            <Link
              to="/app/messages/$clientId"
              params={{ clientId: t.clientId }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-line"
            >
              <span>
                <span className="block font-semibold">{t.clientName}</span>
                <span className="text-sm text-muted">
                  {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : ""}
                  {t.mode === "read" ? " · Read-only" : ""}
                </span>
              </span>
              {t.unread ? <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-semibold text-on-forest">{t.unread}</span> : null}
            </Link>
          </li>
        ))}
        {threads && threads.length === 0 ? <p className="text-muted">No conversations yet.</p> : null}
      </ul>
    </div>
  );
}
