"use client";
import { Brand } from "@/components/Brand";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function BookPage() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("coach") || "tim-zhang";
  const today = useMemo(() => new Date(), []);
  const [day, setDay] = useState(dateKey(today));
  const [slots, setSlots] = useState<string[]>([]);
  const [picked, setPicked] = useState("");
  const [locations, setLocations] = useState<{ id: string }[]>([]);

  useEffect(() => {
    fetch(`/api/slots?coach=${slug}&date=${day}`)
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.slots || []);
        setLocations(d.locations || []);
        setPicked("");
      });
  }, [slug, day]);

  function continueBook() {
    if (!picked) return;
    const q = `coach=${slug}&start=${encodeURIComponent(picked)}`;
    if (locations.length > 1) router.push(`/book/location?${q}`);
    else if (locations.length === 1) router.push(`/book/pay?${q}&location=${locations[0].id}`);
  }

  return (
    <main className="phone px-5 pb-8">
      <Brand />
      <h1 className="text-2xl font-bold">Select date & time</h1>
      <p className="text-muted">Private · 60 min</p>
      <label className="mt-4 block text-sm text-muted">Date</label>
      <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="field mt-1" />
      <h2 className="mt-6 font-semibold">Available times</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {slots.map((s) => {
          const label = new Date(s).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
          const on = picked === s;
          return (
            <button key={s} onClick={() => setPicked(s)} className={`rounded-xl border px-3 py-2 ${on ? "border-brand bg-brand-soft text-brand-dark" : "border-line"}`}>
              {label}
            </button>
          );
        })}
        {slots.length === 0 && <p className="col-span-2 text-sm text-muted">No open times this day.</p>}
      </div>
      <button
        disabled={!picked}
        onClick={continueBook}
        className="mt-8 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
      >
        Continue
      </button>
    </main>
  );
}
