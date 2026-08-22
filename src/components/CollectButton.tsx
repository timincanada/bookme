"use client";
import { useState } from "react";

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
  if (done) return <span className="rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[#059669]">Collected</span>;
  return (
    <button onClick={mark} className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-700">
      Mark collected
    </button>
  );
}
