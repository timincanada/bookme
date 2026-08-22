"use client";
import { Brand } from "@/components/Brand";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatWhen } from "@/lib/time";
import { looksLikeEmail } from "@/lib/email";

export default function PayPage() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("coach") || "tim-zhang";
  const start = params.get("start") || "";
  const locationId = params.get("location") || "";
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/slots?coach=${slug}&date=${start.slice(0, 10)}`)
      .then((r) => r.json())
      .then((d) => {
        setMeta(d);
        if (d.acceptCash === false && d.acceptCard !== false) setMethod("card");
        else if (d.acceptCard === false) setMethod("cash");
        const list = d.locations || [];
        if (list.length > 1 && !params.get("location")) {
          router.replace(`/book/location?coach=${slug}&start=${encodeURIComponent(start)}`);
        }
      });
  }, [slug, start]);

  async function submit() {
    if (!looksLikeEmail(email)) {
      setError("Enter a valid email");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, start, name, email, method, locationId }),
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

  const when = start ? formatWhen(new Date(start)) : "";

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Review & pay</h1>
      <p className="text-muted">{meta?.coachName || "Coach"} · Private · 60 min</p>
      <div className="mt-4 card text-sm">
        <div>{when}</div>
        <div className="mt-1 text-muted">{(meta?.locations || []).find((l: any) => l.id === locationId)?.name || (meta?.locations?.length === 1 ? meta.locations[0].name : "")}</div>
        <div className="mt-2 font-semibold">Total CA${(meta?.priceCad || 80).toFixed(2)}</div>
      </div>
      <label className="mt-5 block text-sm">Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1" />
      <label className="mt-3 block text-sm">Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1" placeholder="you@email.com" inputMode="email" autoComplete="email" />
      <p className="mt-5 font-semibold">Payment</p>
      <div className="mt-2 space-y-2">
        {meta?.acceptCard !== false && (
          <button type="button" onClick={() => setMethod("card")} className={`w-full rounded-2xl border px-4 py-3 text-left ${method === "card" ? "border-brand bg-brand-soft text-brand-dark" : "border-line"}`}>
            <div className="font-semibold">Pay with card</div>
            <div className="text-sm text-muted">CAD · held 15 minutes at checkout</div>
          </button>
        )}
        {meta?.acceptCash !== false && (
          <button type="button" onClick={() => setMethod("cash")} className={`w-full rounded-2xl border px-4 py-3 text-left ${method === "cash" ? "border-brand bg-brand-soft text-brand-dark" : "border-line"}`}>
            <div className="font-semibold">Pay with cash</div>
            <div className="text-sm text-muted">Pay cash on arrival</div>
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button disabled={busy || !name || !email} onClick={submit} className="mt-6 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
        {method === "cash" ? "Confirm booking" : "Pay CA$80"}
      </button>
    </main>
  );
}
