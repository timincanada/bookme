"use client";
import { Brand } from "@/components/Brand";
import { VisitBeacon } from "@/components/VisitBeacon";
import { MonthCal } from "@/components/MonthCal";
import { formatTime, torontoDateKey } from "@/lib/time";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function BookClient() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("coach") || "tim-zhang";
  const [day, setDay] = useState(() => torontoDateKey());
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
      <VisitBeacon />
      <Brand />
      <h1 className="text-2xl font-bold">Select date & time</h1>
      <p className="text-muted">Private · 60 min</p>
      <MonthCal value={day} onChange={setDay} />
      <h2 className="mt-6 font-semibold">Available times</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {slots.map((s) => {
          const label = formatTime(new Date(s));
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
