"use client";
import { Brand } from "@/components/Brand";
import { DURATIONS, VERTICALS } from "@/lib/setup";
import Link from "next/link";
import { useEffect, useState } from "react";

const STEPS = ["Basics", "Locations", "Hours", "Link"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Loc = { id: string; name: string; address: string; kind: string; active: boolean };
type Hour = { weekday: number; startMin: number; endMin: number };

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("Tennis");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [duration, setDuration] = useState(60);
  const [priceCad, setPriceCad] = useState(80);

  const [locations, setLocations] = useState<Loc[]>([]);
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locKind, setLocKind] = useState("in_person");

  const [hours, setHours] = useState<Hour[]>(
    [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 10 * 60, endMin: 20 * 60 })),
  );

  const [slug, setSlug] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [subStatus, setSubStatus] = useState("none");

  useEffect(() => {
    fetch("/api/coach/me").then(async (r) => {
      if (r.status === 401) {
        window.location.href = "/app/login";
        return;
      }
      const d = await r.json();
      setName(d.name || "");
      setTitle(d.title || "Tennis");
      setCity(d.city || "");
      setTimezone(d.timezone || "America/Toronto");
      if (d.service) {
        setDuration(d.service.duration);
        setPriceCad(d.service.priceCad);
      }
      setLocations(d.locations || []);
      if (d.hours?.length) setHours(d.hours);
      setSlug(d.slug);
      setCanCopy(!!d.canCopyLink);
      setSubStatus(d.subscriptionStatus || "none");
    });
  }, []);

  async function saveBasics() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/coach/basics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title, city, timezone, duration, priceCad }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    setStep(1);
  }

  async function addLocation() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/coach/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: locName, address: locAddress, kind: locKind }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add location");
      return;
    }
    setLocations((prev) => [
      ...prev,
      { id: data.id, name: locName, address: locAddress, kind: locKind, active: true },
    ]);
    setLocName("");
    setLocAddress("");
  }

  async function toggleLocation(id: string, active: boolean) {
    await fetch("/api/coach/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, active } : l)));
  }

  async function saveHours() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/coach/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save hours");
      return;
    }
    const me = await fetch("/api/coach/me").then((r) => r.json());
    setCanCopy(!!me.canCopyLink);
    setSubStatus(me.subscriptionStatus || "none");
    setStep(3);
  }

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

  const link = typeof window !== "undefined" ? `${window.location.origin}/${slug}` : `/${slug}`;
  const activeLocations = locations.filter((l) => l.active);

  return (
    <main className="phone px-5 pb-10">
      <Brand />
      <p className="text-sm text-muted">Step {step + 1} of 4</p>
      <h1 className="text-2xl font-bold">Open for business</h1>
      <div className="mt-3 flex gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-line"}`} />
        ))}
      </div>

      {step === 0 && (
        <section className="mt-6 space-y-3">
          <label className="block text-sm">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
          <label className="block text-sm">Vertical</label>
          <select value={title} onChange={(e) => setTitle(e.target.value)} className="field">
            {VERTICALS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <label className="block text-sm">Default duration</label>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-xl border py-2 text-sm ${duration === d ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                {d}m
              </button>
            ))}
          </div>
          <label className="block text-sm">Price (CAD)</label>
          <input type="number" value={priceCad} onChange={(e) => setPriceCad(Number(e.target.value))} className="field" />
          <label className="block text-sm">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="field" />
          <label className="block text-sm">Timezone</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field" />
          <button disabled={busy} onClick={saveBasics} className="w-full rounded-2xl bg-brand py-3 font-semibold text-white">
            Continue
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="mt-6">
          <p className="text-muted">Add at least one location to publish.</p>
          <ul className="mt-3 space-y-2">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-2xl border border-line p-3">
                <div>
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-sm text-muted">{l.address || l.kind}</div>
                </div>
                <button onClick={() => toggleLocation(l.id, !l.active)} className="text-sm text-brand">
                  {l.active ? "Disable" : "Enable"}
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-4 block text-sm">Location name</label>
          <input value={locName} onChange={(e) => setLocName(e.target.value)} className="field mt-1" placeholder="Court 3" />
          <label className="mt-3 block text-sm">Address</label>
          <input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} className="field mt-1" />
          <label className="mt-3 block text-sm">Type</label>
          <select value={locKind} onChange={(e) => setLocKind(e.target.value)} className="field mt-1">
            <option value="in_person">In person</option>
            <option value="house_call">House call</option>
            <option value="online">Online</option>
          </select>
          <button disabled={busy || !locName} onClick={addLocation} className="mt-3 w-full rounded-2xl border border-line py-3 font-semibold">
            Add location
          </button>
          <button
            disabled={activeLocations.length === 0}
            onClick={() => setStep(2)}
            className="mt-3 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="mt-6">
          <p className="text-muted">Repeating weekly hours. Students only see open slots.</p>
          <div className="mt-3 space-y-2">
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
                        value={`${String(Math.floor(row.startMin / 60)).padStart(2, "0")}:${String(row.startMin % 60).padStart(2, "0")}`}
                        onChange={(e) => {
                          const [hh, mm] = e.target.value.split(":").map(Number);
                          setDayTime(weekday, "startMin", hh * 60 + mm);
                        }}
                        className="field py-1"
                      />
                      <input
                        type="time"
                        value={`${String(Math.floor(row.endMin / 60)).padStart(2, "0")}:${String(row.endMin % 60).padStart(2, "0")}`}
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
          <button disabled={busy || hours.length === 0} onClick={saveHours} className="mt-4 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40">
            Continue
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="mt-6">
          <p className="text-muted">Your booking link publishes only after a trial or paid plan is active.</p>
          <div className="mt-4 card text-sm">
            <div className="text-muted">Share this link</div>
            <div className="mt-1 break-all font-semibold">{link}</div>
          </div>
          {canCopy ? (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
              className="mt-4 w-full rounded-2xl bg-brand py-3 font-semibold text-white"
            >
              {copied ? "Copied" : "Copy booking link"}
            </button>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-muted">
                {subStatus === "none" || subStatus === "canceled"
                  ? "Start the 3-day Light trial (card required) to copy and send this link."
                  : "Your plan is not active, so the link cannot be published yet."}
              </p>
              <Link href="/app/billing" className="mt-3 block w-full rounded-2xl bg-brand py-3 text-center font-semibold text-white">
                Start 3-day trial
              </Link>
            </div>
          )}
          <Link href="/app/schedule" className="mt-3 block w-full rounded-xl border border-line py-3 text-center font-semibold">
            Go to schedule
          </Link>
        </section>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </main>
  );
}
