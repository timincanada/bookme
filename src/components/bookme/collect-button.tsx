import { useState } from "react";
import { Button } from "@/components/ui/button";
import { collectLesson } from "@/lib/bookme/api";

export function CollectButton({ lessonId, onCollected }: { lessonId: string; onCollected?: () => void }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return null;
  return (
    <Button
      size="field"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await collectLesson({ data: { lessonId } });
        setBusy(false);
        if (res.ok) {
          setDone(true);
          onCollected?.();
        }
      }}
    >
      Mark collected
    </Button>
  );
}
