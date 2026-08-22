"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import Link from "next/link";
import { useEffect, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Hour = { weekday: number; startMin: number; endMin: number };

function clock(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default function MoreHoursPage() {
  const [hours, setHours] = useState<Hour[]>([]);
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

  function toggleDay(weekday: number) {
    setHours((prev) => {
      const exists = prev.find((h) => h.weekday === weekday);
      if (exists) return prev.filter((h) => h.weekday !== weekday);
      return [...prev, { weekday, startMin: 10 * 60, endMin: 20 * 60 }].sort((a, b) => a.weekday - b.weekday);
    });
  }

  function setDayTime(weekday: number, field: "startMin" | "endMin", value: number) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, [field]: value } : h)));
  }

  async function save() {
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

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/more" className="text-sm font-semibold text-brand">More</Link>
      <h1 className="mt-2 text-2xl font-bold">Weekly hours</h1>
      <p className="text-muted">Repeating windows. Students only see open slots.</p>
      <div className="mt-4 space-y-2">
        {DAYS.map((label, weekday) => {
          const row = hours.find((h) => h.weekday === weekday);
          return (
            <div key={label} className="rounded-2xl border border-line p-3">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={!!row} onChange={() => toggleDay(weekday)} />
                {label}
              </label>
              {row && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <input
                    type="time"
                    value={clock(row.startMin)}
                    onChange={(e) => {
                      const [hh, mm] = e.target.value.split(":").map(Number);
                      setDayTime(weekday, "startMin", hh * 60 + mm);
                    }}
                    className="field py-1"
                  />
                  <input
                    type="time"
                    value={clock(row.endMin)}
                    onChange={(e) => {
                      const [hh, mm] = e.target.value.split(":").map(Number);
                      setDayTime(weekday, "endMin", hh * 60 + mm);
                    }}
                    className="field py-1"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-3 text-sm text-brand-dark">{saved}</p>}
      <button disabled={busy} onClick={save} className="mt-4 w-full rounded-2xl bg-brand py-3 font-semibold text-white">
        Save hours
      </button>
      <TabBar active="more" />
    </main>
  );
}
