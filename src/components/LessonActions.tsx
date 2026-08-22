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
  const [picked, setPicked] = useState("");
  const [done, setDone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPicked("");
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
    setDone(url.includes("cancel") ? "Lesson cancelled." : "Lesson updated.");
  }

  function closeDone() {
    const next = done;
    setDone("");
    if (next === "Lesson cancelled.") router.push("/app/schedule");
  }

  return (
    <div className="mt-6 space-y-4">
      <section>
        <h2 className="font-semibold">Reschedule</h2>
        <p className="text-sm text-muted">Same price. A held card stay held, not confirmed.</p>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="field mt-2" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => setPicked(s)}
              className={"rounded-xl border px-2 py-2 text-sm " + (picked === s ? "border-brand bg-brand text-white" : "border-line bg-white")}
            >
              {new Date(s).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
            </button>
          ))}
        </div>
        {slots.length > 0 && (
          <button
            type="button"
            disabled={busy || !picked}
            onClick={() => post("/api/coach/lessons/move", { lessonId, start: picked })}
            className="mt-3 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
            Reschedule
          </button>
        )}
      </section>
      {confirmed && (
        <button
          disabled={busy || !canBookNext}
          onClick={() => post("/api/coach/lessons/next-week", { lessonId })}
          className="w-full rounded-2xl border border-line py-3 font-semibold disabled:opacity-40"
        >
          Book same time next week
        </button>
      )}
      {!canBookNext && confirmed && (
        <p className="text-sm text-muted">Start a trial to book next week.</p>
      )}
      <button
        disabled={busy}
        onClick={() => post("/api/coach/lessons/cancel", { lessonId })}
        className="w-full rounded-2xl border border-danger/30 py-3 font-semibold text-danger"
      >
        Cancel lesson
      </button>
      {msg && <p className="text-sm text-danger">{msg}</p>}
      {done && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-5">
          <div className="w-full rounded-3xl bg-white p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5L20 7" /></svg>
            </div>
            <p className="mt-3 text-lg font-semibold">{done}</p>
            <button type="button" onClick={closeDone} className="mt-5 w-full rounded-2xl bg-brand py-3 font-semibold text-white">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
