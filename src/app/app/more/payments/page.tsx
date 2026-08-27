"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MorePaymentsPage() {
  const [acceptCard, setAcceptCard] = useState(false);
  const [acceptCash, setAcceptCash] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/coach/me").then(async (r) => {
      if (r.status === 401) {
        window.location.href = "/app/login";
        return;
      }
      const d = await r.json();
      setConnected(!!d.stripeConnected);
      setAcceptCard(!!d.stripeConnected && !!d.acceptCard);
      setAcceptCash(d.acceptCash !== false);
    });
  }, []);

  async function connect() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/coach/connect", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setBusy(false);
      setError(data.error || "Could not start Stripe Connect");
      return;
    }
    window.location.href = data.url;
  }

  async function save(nextCard: boolean, nextCash: boolean) {
    if (nextCard && !connected) {
      await connect();
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    const res = await fetch("/api/coach/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptCard: nextCard, acceptCash: nextCash }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (data.needsConnect) {
        await connect();
        return;
      }
      setError(data.error || "Keep at least one method on");
      return;
    }
    setAcceptCard(data.acceptCard);
    setAcceptCash(data.acceptCash);
    setSaved("Saved");
  }

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/more" className="text-sm font-semibold text-brand">More</Link>
      <h1 className="mt-2 text-2xl font-bold">Accepted payments</h1>
      <p className="text-muted">Checkout only shows what you turn on. Keep at least one. Card needs Stripe Connect. BookMe keeps 5% on cards. Cash has no fee.</p>
      <div className="mt-5 space-y-3">
        <label className="flex items-center justify-between card">
          <div>
            <div className="font-semibold">Card</div>
            <div className="text-sm text-muted">{connected ? "Stripe, CAD, pay to confirm" : "Connect Stripe to take cards"}</div>
          </div>
          <input
            type="checkbox"
            checked={acceptCard}
            disabled={busy}
            onChange={(e) => save(e.target.checked, acceptCash)}
          />
        </label>
        <label className="flex items-center justify-between card">
          <div>
            <div className="font-semibold">Cash</div>
            <div className="text-sm text-muted">Confirm now, collect in person</div>
          </div>
          <input
            type="checkbox"
            checked={acceptCash}
            disabled={busy}
            onChange={(e) => save(acceptCard, e.target.checked)}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-3 text-sm text-brand-dark">{saved}</p>}
      <TabBar active="more" />
    </main>
  );
}
