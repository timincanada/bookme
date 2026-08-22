"use client";
import { Brand } from "@/components/Brand";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BillingPage() {
  const [status, setStatus] = useState("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/billing/status?slug=tim-zhang")
      .then((r) => r.json())
      .then((d) => setStatus(d.status || "none"));
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "tim-zhang" }),
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
      body: JSON.stringify({ slug: "tim-zhang" }),
    });
    setBusy(false);
    if (res.ok) setStatus("canceled");
  }

  const open = status === "trialing" || status === "active";

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <h1 className="text-2xl font-bold">BookMe plan</h1>
      <p className="mt-2 text-slate-500">CA$29 / month. 3-day trial, then auto-renew. A card is required to start the trial. Student lesson payments are separate.</p>
      <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">Status: {status}</div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {!open && (
        <button disabled={busy} onClick={start} className="mt-6 w-full rounded-xl bg-[#10B981] py-3 font-semibold text-white disabled:opacity-40">
          Start 3-day trial
        </button>
      )}
      {open && (
        <button disabled={busy} onClick={cancel} className="mt-6 w-full rounded-xl border border-slate-200 py-3 font-semibold">
          Cancel plan
        </button>
      )}
      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 justify-around border-t bg-white py-3 text-xs">
        <Link href="/app/schedule">Schedule</Link>
        <Link href="/manage">Bookings</Link>
        <Link href="/">Clients</Link>
        <span className="font-semibold text-[#10B981]">More</span>
      </nav>
    </main>
  );
}
