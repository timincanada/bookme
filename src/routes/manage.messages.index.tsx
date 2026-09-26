import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { studentListConversations } from "@/lib/bookme/messages-api";
import { useStudent } from "@/lib/bookme/student-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manage/messages/")({ component: StudentInbox });

type Threads = Extract<
  Awaited<ReturnType<typeof studentListConversations>>,
  { ok: true }
>["threads"];

function StudentInbox() {
  const { signedOut } = useStudent();
  const [threads, setThreads] = useState<Threads | null>(null);

  useEffect(() => {
    studentListConversations().then((r) => {
      if (!r.ok) return signedOut();
      setThreads(r.threads);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!threads) return <p className="mt-6 text-muted">Loading…</p>;
  return (
    <>
      <p className="mt-5 text-sm text-muted">Message the coaches you've booked with.</p>
      <ul className="mt-4 space-y-2">
        {threads.map((t) => (
          <li key={t.coachId}>
            <Link
              to="/manage/messages/$coachId"
              params={{ coachId: t.coachId }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-line"
            >
              <span>
                <span className={cn("block", t.unread ? "type-key font-semibold" : "type-primary font-medium")}>
                  {t.coachName}
                </span>
                {t.lastPreview ? (
                  <span className="type-secondary block truncate text-sm text-muted">{t.lastPreview}</span>
                ) : null}
                <span className="type-meta text-sm text-muted">
                  {t.lastMessageAt
                    ? new Date(t.lastMessageAt).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                      })
                    : "No messages yet"}
                  {t.mode === "read" ? " · Read-only" : ""}
                </span>
              </span>
              {t.unread ? (
                <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-semibold text-on-forest">
                  {t.unread}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
        {threads.length === 0 ? (
          <p className="text-muted">Messages open after a confirmed lesson with a coach.</p>
        ) : null}
      </ul>
    </>
  );
}
