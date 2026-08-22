"use client";
import { Brand } from "@/components/Brand";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ManagePage() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [lessons, setLessons] = useState<any[]>([]);
  const [picked, setPicked] = useState<any>(null);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`/api/lessons?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setLessons(data.lessons || []);
  }

  useEffect(() => {
    if (params.get("email")) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!picked) return;
    fetch(`/api/slots?coach=${picked.coachSlug}&date=${day}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [picked, day]);

  async function act(action: string, start?: string) {
    const res = await fetch("/api/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: picked.id, email, action, start }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg(action === "cancel" ? "Cancelled." : "Rescheduled.");
      setPicked(null);
      load();
    }
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Your bookings</h1>
      <p className="text-slate-500">Use the email from your booking.</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-4 w-full rounded-xl border px-3 py-2" placeholder="you@email.com" />
      <button onClick={load} className="mt-3 w-full rounded-xl bg-[#10B981] py-3 font-semibold text-white">Find bookings</button>
      {msg && <p className="mt-3 text-sm text-[#059669]">{msg}</p>}
      <ul className="mt-6 space-y-3">
        {lessons.map((l) => (
          <li key={l.id} className="rounded-xl border border-slate-200 p-4">
            <div className="font-semibold">{l.coachName}</div>
            <div className="text-sm text-slate-500">{new Date(l.startAt).toLocaleString()}</div>
            <div className="text-sm">{l.status} · {l.payStatus} · {l.method}</div>
            {l.status === "confirmed" && (
              <button onClick={() => setPicked(l)} className="mt-2 text-sm font-semibold text-[#10B981]">Reschedule or cancel</button>
            )}
          </li>
        ))}
      </ul>
      {picked && (
        <div className="mt-6 rounded-xl border p-4">
          <p className="font-semibold">Move this lesson</p>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {slots.map((s) => (
              <button key={s} onClick={() => act("reschedule", s)} className="rounded-xl border border-slate-200 px-2 py-2 text-sm">
                {new Date(s).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
              </button>
            ))}
          </div>
          <button onClick={() => act("cancel")} className="mt-4 w-full rounded-xl border border-red-200 py-2 text-red-600">Cancel lesson</button>
        </div>
      )}
    </main>
  );
}
