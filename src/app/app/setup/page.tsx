"use client";
import { Brand } from "@/components/Brand";
import { AddressAutocomplete, emptyAddress, type AddressValue } from "@/components/AddressAutocomplete";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { WeeklyHoursEditor } from "@/components/WeeklyHoursEditor";
import { DURATIONS, VERTICALS } from "@/lib/setup";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { validateWeeklyHours, type HourSegment } from "@/lib/hours";
import Link from "next/link";
import { useEffect, useState } from "react";
import { publicAppUrl } from "@/lib/app-url";

const STEPS = ["Basics", "Locations", "Hours", "Link"];

type Loc = {
  id: string;
  name: string;
  address: string;
  kind: string;
  active: boolean;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  verified?: boolean;
};

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("Tennis");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [duration, setDuration] = useState(60);
  const [priceCad, setPriceCad] = useState(80);

  const [locations, setLocations] = useState<Loc[]>([]);
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState<AddressValue>(emptyAddress());
  const [locKind, setLocKind] = useState("in_person");

  const [hours, setHours] = useState<HourSegment[]>(
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
      setTimezone(d.timezone || DEFAULT_TIMEZONE);
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

  function onAddressChange(next: AddressValue) {
    setLocAddress(next);
    if (next.city) setCity(next.city);
    if (next.timezone) setTimezone(next.timezone);
  }

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
      body: JSON.stringify({
        name: locName,
        address: locAddress.address,
        kind: locKind,
        placeId: locAddress.placeId,
        lat: locAddress.lat,
        lng: locAddress.lng,
        verified: locAddress.verified,
        city: locAddress.city || city || undefined,
        timezone: locAddress.timezone || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add location");
      return;
    }
    setLocations((prev) => [
      ...prev,
      {
        id: data.id,
        name: locName,
        address: locAddress.address,
        kind: locKind,
        active: true,
        placeId: locAddress.placeId,
        lat: locAddress.lat,
        lng: locAddress.lng,
        verified: locAddress.verified,
      },
    ]);
    if (locAddress.city) setCity(locAddress.city);
    if (locAddress.timezone) setTimezone(locAddress.timezone);
    setLocName("");
    setLocAddress(emptyAddress());
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
    const check = validateWeeklyHours(hours);
    if (!check.ok) {
      setError(check.error);
      return;
    }
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

  const hoursValid = validateWeeklyHours(hours).ok;
  const link = `${publicAppUrl()}/${slug}`;
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
          <p className="text-muted">Students book from these defaults.</p>
          <label className="block text-sm font-semibold">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" />
          <label className="block text-sm font-semibold">Vertical</label>
          <select value={title} onChange={(e) => setTitle(e.target.value)} className="field">
            {VERTICALS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <label className="block text-sm font-semibold">Default duration</label>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-xl border py-2 text-sm ${duration === d ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                {d}m
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold">Price (CAD)</label>
          <input type="number" value={priceCad} onChange={(e) => setPriceCad(Number(e.target.value))} className="field" />
          <label className="block text-sm font-semibold">City</label>
          <input value={city} readOnly className="field bg-line/30 text-muted" placeholder="Select an address in Locations" />
          <p className="text-sm text-muted">From your location address</p>
          <label className="block text-sm font-semibold">Timezone</label>
          <TimezoneSelect value={timezone} onChange={setTimezone} />
          <button
            disabled={busy || !timezone}
            onClick={saveBasics}
            className="w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
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
                  <div className="text-sm text-muted">
                    {l.address || l.kind}
                    {l.verified === false && l.address ? " · unverified" : ""}
                  </div>
                </div>
                <button type="button" onClick={() => toggleLocation(l.id, !l.active)} className="text-sm text-brand">
                  {l.active ? "Disable" : "Enable"}
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-4 block text-sm font-semibold">Location name</label>
          <input
            value={locName}
            onChange={(e) => setLocName(e.target.value)}
            className="field mt-1"
            placeholder="Court 3"
          />
          <label className="mt-3 block text-sm font-semibold">Address</label>
          <AddressAutocomplete value={locAddress} onChange={onAddressChange} />
          <label className="mt-3 block text-sm font-semibold">Type</label>
          <select value={locKind} onChange={(e) => setLocKind(e.target.value)} className="field mt-1">
            <option value="in_person">In person</option>
            <option value="house_call">House call</option>
            <option value="online">Online</option>
          </select>
          <button
            disabled={busy || !locName}
            onClick={addLocation}
            className="mt-3 w-full rounded-2xl border border-line py-3 font-semibold"
          >
            Add location
          </button>
          <button
            disabled={activeLocations.length === 0}
            onClick={() => setStep(2)}
            className="mt-3 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
          <p className="mt-4 text-center text-xs text-muted">Google Places · structured address + place_id</p>
        </section>
      )}

      {step === 2 && (
        <section className="mt-6">
          <p className="text-muted">Repeating weekly hours. Students only see open slots.</p>
          <WeeklyHoursEditor hours={hours} onChange={setHours} />
          <button
            disabled={busy || !hoursValid}
            onClick={saveHours}
            className="mt-4 w-full rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="mt-6">
          <p className="text-muted">Your booking link is ready to share after setup.</p>
          <div className="mt-4 card text-sm">
            <div className="text-muted">Share this link</div>
            <div className="mt-1 break-all font-semibold">{link}</div>
          </div>
          {canCopy ? (
            <button
              type="button"
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
