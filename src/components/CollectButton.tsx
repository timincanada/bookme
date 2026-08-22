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
    <button
      onClick={mark}
      className="rounded-xl bg-warn px-4 py-2.5 text-sm font-semibold text-white"
    >
      Mark collected
    </button>
  );
}
