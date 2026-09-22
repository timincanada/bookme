import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageThread } from "@/components/bookme/message-thread";
import { ThreadContextCards } from "@/components/bookme/thread-context-cards";
import { studentGetThread, studentMarkRead, studentSendMessage } from "@/lib/bookme/messages-api";

export const Route = createFileRoute("/manage/messages/$coachId")({ component: StudentThread });

function StudentThread() {
  const { coachId } = Route.useParams();
  return (
    <>
      <Link to="/manage/messages" className="mt-5 inline-block text-sm font-semibold text-forest">
        All messages
      </Link>
      <MessageThread
        key={coachId}
        viewer="student"
        banner={<ThreadContextCards audience="student" coachId={coachId} />}
        load={(after) => studentGetThread({ data: { coachId, after } })}
        send={(body) => studentSendMessage({ data: { coachId, body } })}
        markRead={() => studentMarkRead({ data: { coachId } })}
      />
    </>
  );
}
