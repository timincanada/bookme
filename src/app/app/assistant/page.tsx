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

function AssistantInner() {
  useSearchParams();
  const [me, setMe] = useState<any>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: "Ask me to list openings, email a student on a lesson, or change your hours." }]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/coach/me").then(async (r) => {
      if (r.status === 401) { window.location.href = "/app/login"; return; }
      setMe(await r.json());
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

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

  if (!me) {
    return (
      <main className="phone px-5 pb-24">
        <Brand />
        <p className="text-muted">Loading…</p>
        <TabBar active="assistant" />
      </main>
    );
  }

  return (
    <main className="phone relative flex min-h-[100dvh] flex-col">
      <div className="shrink-0 px-5">
        <Brand />
        <h1 className="text-2xl font-bold">Assistant</h1>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4 pt-4">
        {msgs.map((m, i) => (
          m.role === "you" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-brand px-4 py-3 text-sm text-white">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">B</div>
              <div className="min-w-0 max-w-[85%] rounded-2xl border border-line bg-white px-4 py-3 text-sm">
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
            </div>
          )
        ))}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-line bg-surface px-4 py-2 pb-[calc(3.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            className="min-w-0 flex-1 rounded-full border border-line bg-page px-4 py-3 text-ink outline-none focus:border-brand"
            placeholder="Type a message..."
            disabled={!!locked}
          />
          <button type="button" onClick={listen} disabled={!!locked} className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white " + (listening ? "bg-brand-dark" : "bg-brand")}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>
          </button>
        </div>
      </div>
      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 px-5 pb-28 pt-16">
          <div className="w-full rounded-3xl bg-white p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M12 3l1.2 3.9L17 8.1l-3.8 1.2L12 13.2l-1.2-3.9L7 8.1l3.8-1.2L12 3z"/><path d="M18.5 12.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z"/><path d="M6.2 13.4l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z"/></svg>
            </div>
            <h2 className="mt-3 text-xl font-bold">Assistant is on Coach</h2>
            <ul className="mt-4 space-y-3 text-left text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7h11M8 12h11M8 17h8"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none"/></svg>
                </span>
                List openings
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 8l8 6 8-6"/></svg>
                </span>
                Email a student
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>
                </span>
                Change hours
              </li>
            </ul>
            <p className="mt-4 text-sm">Your plan is Light.</p>
            <Link href="/app/billing" className="mt-5 block rounded-2xl bg-brand py-3 font-semibold text-white">Upgrade to Coach</Link>
            <button type="button" onClick={() => setDismissed(true)} className="mt-3 w-full py-2 font-semibold text-brand">Not now</button>
          </div>
        </div>
      )}
      <TabBar active="assistant" />
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
