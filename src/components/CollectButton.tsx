"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CollectButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  async function mark() {
    const res = await fetch("/api/lessons/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    if (res.ok) { setDone(true); router.refresh(); }
  }
  if (done) return null;
  return (
    <button
      onClick={mark}
      className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white"
    >
      Mark collected
    </button>
  );
}
