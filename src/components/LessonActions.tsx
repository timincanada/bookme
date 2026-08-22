"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LessonActions({
  lessonId,
  coachSlug,
  confirmed,
  canBookNext,
}: {
  lessonId: string;
  coachSlug: string;
  confirmed: boolean;
  canBookNext: boolean;
}) {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!day) return;
    fetch(`/api/slots?coach=${coachSlug}&date=${day}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [coachSlug, day]);

  async function post(url: string, body: object) {
    setBusy(true);
    setMsg("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Could not update");
      return;
    }
    router.refresh();
    if (url.includes("cancel")) router.push("/app/schedule");
    else setMsg("Updated. The student was emailed.");
  }

  return (
    <div className="mt-6 space-y-4">
      <section>
        <h2 className="font-semibold">Reschedule</h2>
        <p className="text-sm text-slate-500">Same price. A held card stay held, not confirmed.</p>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => post("/api/coach/lessons/move", { lessonId, start: s })}
              className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
            >
              {new Date(s).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
            </button>
          ))}
        </div>
      </section>
      {confirmed && (
        <button
          disabled={busy || !canBookNext}
          onClick={() => post("/api/coach/lessons/next-week", { lessonId })}
          className="w-full rounded-xl border border-slate-200 py-3 font-semibold disabled:opacity-40"
        >
          Book same time next week
        </button>
      )}
      {!canBookNext && confirmed && (
        <p className="text-sm text-slate-500">Start a trial to book next week.</p>
      )}
      <button
        disabled={busy}
        onClick={() => post("/api/coach/lessons/cancel", { lessonId })}
        className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600"
      >
        Cancel lesson
      </button>
      {msg && <p className="text-sm text-[#059669]">{msg}</p>}
    </div>
  );
}
