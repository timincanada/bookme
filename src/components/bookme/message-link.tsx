import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { coachMessageStatus } from "@/lib/bookme/messages-api";

/** "Message" entry on client and lesson pages; disabled with the reason when not allowed. */
export function MessageLink({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<{ mode: string; note: string } | null>(null);
  useEffect(() => {
    coachMessageStatus({ data: { clientId } }).then((r) => setStatus(r.ok ? { mode: r.mode, note: r.note } : null));
  }, [clientId]);
  if (!status) return null;
  if (status.mode === "none") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
        <Mail className="size-4" strokeWidth={1.75} />
        {status.note}
      </p>
    );
  }
  return (
    <Button variant="outline" size="field" className="mt-3" asChild>
      <Link to="/app/messages/$clientId" params={{ clientId }}>
        <Mail className="mr-1.5 size-4" strokeWidth={1.75} />
        {status.mode === "send" ? "Message" : "View messages"}
      </Link>
    </Button>
  );
}
