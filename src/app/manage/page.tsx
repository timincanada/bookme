"use client";
import { Brand } from "@/components/Brand";
import { useEffect, useState } from "react";
import { formatTime, formatWhen } from "@/lib/time";
import { useSearchParams } from "next/navigation";

export default function ManagePage() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "code" | "list">("request");
  const [lessons, setLessons] = useState<any[]>([]);
  const [picked, setPicked] = useState<any>(null);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadLessons() {
    const res = await fetch("/api/lessons");
    if (!res.ok) {
      setStep("request");
      return;
    }
    const data = await res.json();
    setEmail(data.email || email);
    setLessons(data.lessons || []);
    setStep("list");
  }

  async function verify(body: object) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/manage/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Could not verify");
      setStep("code");
      return;
    }
    setEmail(data.email || email);
    await loadLessons();
  }

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      verify({ token });
      return;
    }
    fetch("/api/manage/me").then((r) => {
      if (r.ok) loadLessons();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!picked) return;
    fetch(`/api/slots?coach=${picked.coachSlug}&date=${day}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [picked, day]);

  async function sendLink() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/manage/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Could not send");
      return;
    }
    setStep("code");
    setMsg("If we have bookings for that email, we sent a one-time link and a 6-digit code. It expires in 30 minutes.");
  }

  async function act(action: string, start?: string) {
    const res = await fetch("/api/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: picked.id, action, start }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error);
    else {
      setMsg(action === "cancel" ? "Cancelled." : "Rescheduled.");
      setPicked(null);
      loadLessons();
    }
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Your bookings</h1>
      {step === "request" && (
        <>
          <p className="text-muted">Use the email from your booking. We send a one-time link — no account needed.</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-4" placeholder="you@email.com" />
          <button disabled={busy || !email} onClick={sendLink} className="mt-3 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
            Send login link
          </button>
        </>
      )}
      {step === "code" && (
        <>
          <p className="text-muted">Open the email link, or enter the 6-digit code.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="field mt-4" placeholder="123456" inputMode="numeric" />
          <button
            disabled={busy || code.trim().length !== 6}
            onClick={() => verify({ email, code: code.trim() })}
            className="mt-3 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
            Verify code
          </button>
          <button disabled={busy} onClick={sendLink} className="mt-3 w-full rounded-2xl border border-line py-3 font-semibold">
            Resend link
          </button>
        </>
      )}
      {msg && <p className="mt-3 text-sm text-brand-dark">{msg}</p>}
      {step === "list" && (
        <>
          <p className="text-muted">{email}</p>
          <p className="text-sm text-muted">Free reschedule until 24 hours before the lesson.</p>
          <ul className="mt-6 space-y-3">
            {lessons.map((l) => (
              <li key={l.id} className="card">
                <div className="font-semibold">{l.coachName}</div>
                <div className="text-sm text-muted">{formatWhen(new Date(l.startAt))}</div>
                <div className="text-sm">{l.status} · {l.payStatus} · {l.method}</div>
                {l.status === "confirmed" && (
                  <button onClick={() => setPicked(l)} className="mt-2 text-sm font-semibold text-brand">Reschedule or cancel</button>
                )}
              </li>
            ))}
            {lessons.length === 0 && <p className="text-muted">No bookings for this email.</p>}
          </ul>
        </>
      )}
      {picked && (
        <div className="card mt-6">
          <p className="font-semibold">Move this lesson</p>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="field mt-2" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {slots.map((s) => (
              <button key={s} onClick={() => act("reschedule", s)} className="rounded-xl border border-line px-2 py-2 text-sm">
                {formatTime(new Date(s))}
              </button>
            ))}
          </div>
          <button onClick={() => act("cancel")} className="mt-4 w-full rounded-2xl border border-danger/30 py-2 font-semibold text-danger">Cancel lesson</button>
        </div>
      )}
    </main>
  );
}
