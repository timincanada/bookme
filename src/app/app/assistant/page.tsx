"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "you" | "assistant"; text: string; confirm?: { summary: string; action: any } };

export default function AssistantPage() {
  const [me, setMe] = useState<any>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: "Ask for open times, message a student, or cancel a lesson. I confirm before emailing or changing the schedule." }]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/coach/me").then(async (r) => {
      if (r.status === 401) { window.location.href = "/app/login"; return; }
      setMe(await r.json());
    });
  }, []);

  async function send(raw?: string) {
    const input = (raw ?? text).trim();
    if (!input || busy) return;
    setText("");
    setMsgs((m) => [...m, { role: "you", text: input }]);
    setBusy(true);
    const res = await fetch("/api/coach/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsgs((m) => [...m, { role: "assistant", text: data.error || "Could not help with that." }]);
      return;
    }
    if (data.needsConfirm) {
      setMsgs((m) => [...m, { role: "assistant", text: data.summary, confirm: { summary: data.summary, action: data.action } }]);
      return;
    }
    setMsgs((m) => [...m, { role: "assistant", text: data.text }]);
  }

  async function confirm(action: any, yes: boolean, idx: number) {
    setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, confirm: undefined } : x)));
    if (!yes) {
      setMsgs((m) => [...m, { role: "assistant", text: "Okay, skipped." }]);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/coach/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true, action }) });
    const data = await res.json();
    setBusy(false);
    setMsgs((m) => [...m, { role: "assistant", text: data.text || data.error || "Done." }]);
  }

  function listen() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMsgs((m) => [...m, { role: "assistant", text: "Voice is not available in this browser. Type instead." }]);
      return;
    }
    if (listening && recRef.current) { recRef.current.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-CA";
    rec.interimResults = false;
    rec.onresult = (e: any) => { const said = e.results[0][0].transcript; setListening(false); send(said); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const caps: string[] = me?.capabilities || [];
  const locked = me && caps.length === 0;

  if (!me) return <main className="phone px-5 pb-24"><Brand /><p className="text-muted">Loading…</p></main>;

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">Assistant</h1>
      {locked ? (
        <div className="mt-4 card">
          <p className="font-semibold">On Coach and Busy</p>
          <p className="mt-1 text-sm text-muted">Light does not include the private assistant. Upgrade to message students, check open times, or change the schedule from here.</p>
          <Link href="/app/billing" className="mt-4 block w-full rounded-2xl bg-brand py-3 text-center font-semibold text-white">See plans</Link>
        </div>
      ) : (
        <>
          <p className="text-muted">Voice or type. Same queue.</p>
          <div className="mt-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={"rounded-2xl px-4 py-3 text-sm " + (m.role === "you" ? "ml-8 bg-brand-soft" : "mr-8 border border-line")}>
                <div>{m.text}</div>
                {m.confirm && (
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy} onClick={() => confirm(m.confirm!.action, true, i)} className="flex-1 rounded-xl bg-brand py-2 font-semibold text-white">Confirm</button>
                    <button disabled={busy} onClick={() => confirm(m.confirm!.action, false, i)} className="flex-1 rounded-xl border border-line py-2 font-semibold">Skip</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} className="field flex-1" placeholder="Open times tomorrow" />
            <button type="button" onClick={listen} className={"rounded-2xl border px-3 font-semibold " + (listening ? "border-brand bg-brand-soft text-brand-dark" : "border-line")}>{listening ? "Stop" : "Mic"}</button>
          </div>
          <button disabled={busy || !text.trim()} onClick={() => send()} className="mt-3 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">Send</button>
        </>
      )}
      <TabBar active="more" />
    </main>
  );
}
