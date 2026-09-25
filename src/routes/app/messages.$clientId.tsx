import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { MessageThread } from "@/components/bookme/message-thread";
import { ThreadContextCards } from "@/components/bookme/thread-context-cards";
import { useCoach } from "@/lib/bookme/coach-context";
import { coachGetThread, coachMarkRead, coachSendMessage } from "@/lib/bookme/messages-api";

export const Route = createFileRoute("/app/messages/$clientId")({ component: CoachThread });

function CoachThread() {
  const { clientId } = Route.useParams();
  const { reload } = useCoach();
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col md:border-x md:border-line">
      <MessageThread
        key={clientId}
        layout="chat"
        viewer="coach"
        leading={
          <Link
            to="/app/messages"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-2"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Messages</span>
          </Link>
        }
        trailing={
          <Link
            to="/app/clients/$id"
            params={{ id: clientId }}
            className="shrink-0 px-2 py-1 text-sm font-semibold text-forest"
          >
            Client
          </Link>
        }
        banner={<ThreadContextCards variant="compact" audience="coach" clientId={clientId} />}
        load={(after) => coachGetThread({ data: { clientId, after } })}
        send={(body) => coachSendMessage({ data: { clientId, body } })}
        markRead={async () => {
          await coachMarkRead({ data: { clientId } });
          reload();
        }}
      />
    </div>
  );
}
