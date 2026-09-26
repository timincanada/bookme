import { createFileRoute, Link } from "@tanstack/react-router";
import { AssistantNameForm } from "@/components/bookme/assistant-name-editor";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/more/assistant")({ component: AssistantNamePage });

function AssistantNamePage() {
  const { coach, reload } = useCoach();
  if (!coach) return null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="type-action text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="mt-3 font-display text-3xl font-medium">Assistant name</h1>
      <p className="mt-2 text-muted">This is what you see at the top of the talk screen, and how the assistant refers to itself.</p>
      <div className="mt-6 max-w-md">
        <AssistantNameForm name={coach.assistantName} onSaved={reload} />
      </div>
      <Link to="/app/assistant" className="mt-8 inline-block text-sm font-semibold text-forest">
        Talk with {coach.assistantName}
      </Link>
    </div>
  );
}
