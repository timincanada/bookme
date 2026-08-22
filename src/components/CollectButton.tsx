"use client";
import { useState } from "react";
import { PayChip } from "./PayChip";

export function CollectButton({ lessonId }: { lessonId: string }) {
  const [done, setDone] = useState(false);
  async function mark() {
    const res = await fetch("/api/lessons/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    if (res.ok) setDone(true);
  }
  if (done) return <PayChip kind="offline" text="Collected offline" />;
  return (
    <button onClick={mark} className="rounded-full border border-warn px-2.5 py-0.5 text-xs font-medium text-warn">
      Mark collected
    </button>
  );
}
