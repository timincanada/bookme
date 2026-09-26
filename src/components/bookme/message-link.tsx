import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { coachMessageStatus } from "@/lib/bookme/messages-api";

/** "Message" entry on client and lesson pages; disabled with the reason when not allowed. */
export function MessageLink({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<{ mode: string; note: string } | null>(null);
  useEffect(() => {
    coachMessageStatus({ data: { clientId } }).then((r) =>
      setStatus(r.ok ? { mode: r.mode, note: r.note } : null),
    );
  }, [clientId]);
  if (!status) return null;
  if (status.mode === "none") {
    return (
      <p className="mt-3 flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <MessageCircle className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 break-words">{status.note}</span>
      </p>
    );
  }
  return (
    <Button variant="outline" size="field" className="mt-3" asChild>
      <Link to="/app/messages/$clientId" params={{ clientId }}>
        <MessageCircle className="mr-1.5 size-4" strokeWidth={1.75} />
        {status.mode === "send" ? "Message" : "View messages"}
      </Link>
    </Button>
  );
}
