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
      body: JSON.stringify({ slug, start, name, email, locationId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not book");
      return;
    }
    router.push(`/book/done?id=${data.id}`);
  }

  const when = start ? formatWhen(new Date(start)) : "";
  const loc = (meta?.locations || []).find((l: any) => l.id === locationId) || (meta?.locations?.length === 1 ? meta.locations[0] : null);

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Review & confirm</h1>
      <p className="text-muted">{meta?.coachName || "Coach"} · Private · {meta?.duration || 60} min</p>
      <div className="mt-4 card text-sm">
        <div>{when}</div>
        <div className="mt-1 text-muted">{loc?.name || ""}</div>
      </div>
      <label className="mt-5 block text-sm">Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1" />
      <label className="mt-3 block text-sm">Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1" placeholder="you@email.com" inputMode="email" autoComplete="email" />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button disabled={busy || !name || !email} onClick={submit} className="mt-6 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
        Confirm booking
      </button>
    </main>
  );
}
