"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Preview = {
  kind?: string;
  heading?: string;
  footer?: string;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  fields?: { label: string; value: string }[];
  groups?: { dateKey: string; label: string; lines: string[] }[];
};
type Msg = { role: "you" | "assistant"; text: string; preview?: Preview; action?: any };

const SHORTCUTS = [
  { label: "Openings this week", text: "Openings this week" },
  { label: "Email a student", text: "Email a student" },
  { label: "Change hours", text: "Change hours" },
];

function AssistantInner() {
  const params = useSearchParams();
  const fromSchedule = params.get("from") === "schedule";
  const [me, setMe] = useState<any>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: "Ask me to list openings, email a student on a lesson, or change your hours." }]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
    setMsgs((m) => [...m, { role: "assistant", text: data.summary || data.text, preview: data.preview, action: data.needsConfirm ? data.action : undefined }]);
  }

  async function confirm(action: any, yes: boolean, idx: number) {
    setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, action: undefined } : x)));
    if (!yes) {
      setMsgs((m) => [...m, { role: "assistant", text: "Okay, nothing changed." }]);
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
    if (!SR) { setMsgs((m) => [...m, { role: "assistant", text: "Voice is not available in this browser. Type instead." }]); return; }
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
  const locked = me && caps.length === 0 && !dismissed;
  const planLabel = me?.subscriptionStatus === "trialing" ? "Trial · Coach" : (me?.plan === "busy" ? "Busy plan" : me?.plan === "coach" ? "Coach plan" : "Light plan");

  if (!me) return <main className="phone px-5 pb-24"><Brand /><p className="text-muted">Loading…</p></main>;

  return (
    <main className="phone relative px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">Assistant</h1>
      <p className="text-sm text-muted">{planLabel}</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm">
        {SHORTCUTS.map((s) => (
          <button key={s.label} type="button" disabled={busy || !!locked} onClick={() => send(s.text)} className="whitespace-nowrap rounded-full border border-line px-3 py-2">{s.label}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "you" ? "ml-10 rounded-2xl bg-brand px-4 py-3 text-sm text-white" : "mr-6 rounded-2xl border border-line bg-white px-4 py-3 text-sm"}>
            {m.preview?.heading && <div className="mb-2 font-semibold text-brand">{m.preview.heading}</div>}
            {!m.preview && <div>{m.text}</div>}
            {m.preview?.groups?.map((g) => (
              <div key={g.dateKey} className="mt-2">
                <div className="font-semibold">{g.label}</div>
                {g.lines.length ? g.lines.map((ln) => <div key={ln} className="text-muted">{ln}</div>) : <div className="text-muted">None</div>}
              </div>
            ))}
            {m.preview?.fields?.map((f, fi) => (
              <div key={fi} className="mt-2">
                {f.label ? <div className="text-xs text-muted">{f.label}</div> : null}
                <div>{f.value}</div>
              </div>
            ))}
            {m.preview?.note && <p className="mt-2 text-sm">{m.preview.note}</p>}
            {m.preview?.footer && <p className="mt-2 text-xs text-muted">{m.preview.footer}</p>}
            {m.action && m.preview && (
              <div className="mt-3">
                <button disabled={busy} onClick={() => confirm(m.action, true, i)} className="w-full rounded-2xl bg-brand py-3 font-semibold text-white">{m.preview.confirmLabel || "Confirm"}</button>
                <button disabled={busy} onClick={() => confirm(m.action, false, i)} className="mt-2 w-full py-2 font-semibold text-brand">{m.preview.cancelLabel || "Skip"}</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} className="field flex-1" placeholder="Type a message..." disabled={!!locked} />
        <button type="button" onClick={listen} disabled={!!locked} className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white " + (listening ? "bg-brand-dark" : "bg-brand")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>
        </button>
      </div>
      {locked && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-ink/40 px-5 pb-28 pt-20">
          <div className="w-full rounded-3xl bg-white p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">B</div>
            <h2 className="mt-3 text-xl font-bold">Assistant is on Coach</h2>
            <p className="mt-2 text-sm text-muted">List openings, email a student, and change hours.</p>
            <p className="mt-1 text-sm text-muted">Your plan is Light.</p>
            <Link href="/app/billing" className="mt-5 block rounded-2xl bg-brand py-3 font-semibold text-white">Upgrade to Coach</Link>
            <button type="button" onClick={() => setDismissed(true)} className="mt-3 w-full py-2 font-semibold text-brand">Not now</button>
          </div>
        </div>
      )}
      <TabBar active={fromSchedule ? "schedule" : "more"} />
    </main>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<main className="phone px-5 pb-24"><p className="text-muted">Loading…</p></main>}>
      <AssistantInner />
    </Suspense>
  );
}

