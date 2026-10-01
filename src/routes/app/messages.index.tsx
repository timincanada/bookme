import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/bookme/ui/card";
import { EmptyState } from "@/components/bookme/ui/empty-state";
import { MessageRow } from "@/components/bookme/ui/message-row";
import { PageFrame } from "@/components/bookme/ui/page-frame";
import { PageTitle } from "@/components/bookme/ui/page-title";
import { ErrorState, ListSkeleton } from "@/components/bookme/ui/screen-states";
import { useDemoUi } from "@/lib/bookme/demo-ui";
import { coachListConversations } from "@/lib/bookme/messages-api";
import { hideQaRecords } from "@/lib/bookme/qa-surface";

export const Route = createFileRoute("/app/messages/")({ component: CoachInbox });

type Threads = Extract<Awaited<ReturnType<typeof coachListConversations>>, { ok: true }>["threads"];

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
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const demo = useDemoUi();

  function load() {
    setPhase("loading");
    coachListConversations()
      .then((r) => {
        if (!r.ok) {
          setPhase("error");
          return;
        }
        setThreads(hideQaRecords(r.threads, demo));
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  return (
    <PageFrame>
      <PageTitle title="Messages" subtitle="Notes between you and your students" />
      {phase === "loading" ? <ListSkeleton /> : null}
      {phase === "error" ? <ErrorState onRetry={load} /> : null}
      {phase === "ready" && threads && threads.length === 0 ? (
        <EmptyState title="No messages yet" body="Messages from students will appear here." />
      ) : null}
      {phase === "ready" && threads && threads.length > 0 ? (
        <Card className="mt-4">
          <ul className="divide-y divide-line">
            {threads.map((t) => (
              <MessageRow
                key={t.clientId}
                clientId={t.clientId}
                name={t.clientName}
                preview={(t.lastPreview || "No messages yet") + (t.mode === "read" ? " · Read-only" : "")}
                time={rowTime(t.lastMessageAt)}
                unread={t.unread}
              />
            ))}
          </ul>
        </Card>
      ) : null}
    </PageFrame>
  );
}
