import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageThread } from "@/components/bookme/message-thread";
import { ThreadContextCards } from "@/components/bookme/thread-context-cards";
import { useCoach } from "@/lib/bookme/coach-context";
import { coachGetThread, coachMarkRead, coachSendMessage } from "@/lib/bookme/messages-api";

export const Route = createFileRoute("/app/messages/$clientId")({ component: CoachThread });

function CoachThread() {
  const { clientId } = Route.useParams();
  const { reload } = useCoach();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/app/messages" className="text-sm font-semibold text-forest">
          Messages
        </Link>
        <Link
          to="/app/clients/$id"
          params={{ id: clientId }}
          className="text-sm font-semibold text-forest"
        >
          Client
        </Link>
      </div>
      <MessageThread
        key={clientId}
        viewer="coach"
        banner={<ThreadContextCards audience="coach" clientId={clientId} />}
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
