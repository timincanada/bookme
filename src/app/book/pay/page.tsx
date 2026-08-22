"use client";
import { Brand } from "@/components/Brand";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PayPage() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("coach") || "tim-zhang";
  const start = params.get("start") || "";
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/slots?coach=${slug}&date=${start.slice(0, 10)}`)
      .then((r) => r.json())
      .then(setMeta);
  }, [slug, start]);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, start, name, email, method }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not book");
      return;
    }
    if (method === "card" && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    router.push(`/book/done?id=${data.id}`);
  }

  const when = start ? new Date(start).toLocaleString("en-CA", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Review & pay</h1>
      <p className="text-slate-500">{meta?.coachName || "Coach"} · Private · 60 min</p>
      <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
        <div>{when}</div>
        <div className="mt-2 font-semibold">Total CA$80.00</div>
      </div>
      <label className="mt-5 block text-sm">Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      <label className="mt-3 block text-sm">Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="you@email.com" />
      <p className="mt-5 font-semibold">Payment</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => setMethod("cash")} className={`rounded-xl border py-2 ${method === "cash" ? "border-[#10B981] bg-[#D1FAE5]" : "border-slate-200"}`}>Cash</button>
        <button onClick={() => setMethod("card")} className={`rounded-xl border py-2 ${method === "card" ? "border-[#10B981] bg-[#D1FAE5]" : "border-slate-200"}`}>Card</button>
      </div>
      {method === "card" && <p className="mt-2 text-sm text-slate-500">Pay by card (CAD). Your time is held for 15 minutes while you check out.</p>}
      {method === "cash" && <p className="mt-2 text-sm text-slate-500">Pay the coach in person. Your spot is confirmed now.</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <button disabled={busy || !name || !email} onClick={submit} className="mt-6 w-full rounded-xl bg-[#10B981] py-3 font-semibold text-white disabled:opacity-40">
        {method === "cash" ? "Confirm booking" : "Pay CA$80"}
      </button>
    </main>
  );
}
