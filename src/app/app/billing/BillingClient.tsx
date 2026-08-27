"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { useEffect, useState } from "react";

const TIERS = [
  { id: "light", name: "Light", price: "CA$19", detail: "Up to 20 confirmed lessons / month" },
  { id: "coach", name: "Coach", price: "CA$29", detail: "21–60 confirmed lessons / month" },
  { id: "busy", name: "Busy", price: "CA$49", detail: "61+ confirmed lessons / month" },
];

export function BillingClient({ initialStatus, initialPlan }: { initialStatus: string; initialPlan: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [plan, setPlan] = useState(initialPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/coach/me").then(async (r) => {
      if (r.status === 401) {
        window.location.href = "/app/login";
        return null;
      }
      return r.json();
    }).then((me) => {
      if (!me) return;
      return fetch("/api/billing/status").then((r) => r.json());
    }).then((d) => {
      if (!d) return;
      setStatus(d.status || "none");
      setPlan(d.plan || "none");
    });
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not start checkout");
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  async function cancel() {
    setBusy(true);
    const res = await fetch("/api/billing/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setBusy(false);
    if (res.ok) {
      setStatus("canceled");
      setPlan("none");
    }
  }

  const open = status === "trialing" || status === "active";

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">BookMe plan</h1>
      <p className="mt-2 text-muted">3-day trial on Light (card required), then auto-renew. Tier follows last month&apos;s confirmed lessons at the next cycle. Students book without paying.</p>
      <ul className="mt-4 space-y-2 text-sm">
        {TIERS.map((t) => (
          <li key={t.id} className={`rounded-xl border p-3 ${plan === t.id ? "border-brand bg-brand-soft" : "border-line"}`}>
            <div className="font-semibold">{t.name} · {t.price}</div>
            <div className="text-muted">{t.detail}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 card text-sm">Status: {status}{plan !== "none" ? ` · ${plan}` : ""}</div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {!open && (
        <button disabled={busy} onClick={start} className="mt-6 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
          Start 3-day Light trial
        </button>
      )}
      {open && (
        <button disabled={busy} onClick={cancel} className="mt-6 w-full rounded-2xl border border-line py-3 font-semibold">
          Cancel plan
        </button>
      )}
      <TabBar active="more" />
    </main>
  );
}
