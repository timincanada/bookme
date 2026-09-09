"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { WeeklyHoursEditor } from "@/components/WeeklyHoursEditor";
import { validateWeeklyHours, type HourSegment } from "@/lib/hours";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MoreHoursPage() {
  const [hours, setHours] = useState<HourSegment[]>([]);
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
      setHours(d.hours || []);
    });
  }, []);

  async function save() {
    const check = validateWeeklyHours(hours);
    if (!check.ok) {
      setError(check.error);
      setSaved("");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    const res = await fetch("/api/coach/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    setSaved("Saved");
  }

  const hoursValid = hours.length === 0 || validateWeeklyHours(hours).ok;

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/more" className="text-sm font-semibold text-brand">
        More
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Weekly hours</h1>
      <p className="text-muted">Repeating weekly hours. Students only see open slots.</p>
      <WeeklyHoursEditor hours={hours} onChange={setHours} />
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-3 text-sm text-brand-dark">{saved}</p>}
      <button
        disabled={busy || (hours.length > 0 && !hoursValid)}
        onClick={save}
        className="mt-4 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
      >
        Save hours
      </button>
      <TabBar active="more" />
    </main>
  );
}
