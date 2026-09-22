import { createFileRoute } from "@tanstack/react-router";
import { AssistantPresence } from "@/components/bookme/assistant-presence";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/assistant")({ component: Assistant });

function Assistant() {
  const { coach } = useCoach();
  if (!coach) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AssistantPresence coach={coach} />
    </div>
  );
}
