"use client";
import { Brand } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import Link from "next/link";
import { useEffect, useState } from "react";

type Loc = { id: string; name: string; address: string; kind: string; active: boolean };

export default function MoreLocationsPage() {
  const [locations, setLocations] = useState<Loc[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState("in_person");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/coach/me");
    if (r.status === 401) {
      window.location.href = "/app/login";
      return;
    }
    const d = await r.json();
    setLocations(d.locations || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/coach/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, kind }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add");
      return;
    }
    setName("");
    setAddress("");
    load();
  }

  async function toggle(id: string, active: boolean) {
    setError("");
    const res = await fetch("/api/coach/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update");
      return;
    }
    load();
  }

  return (
    <main className="phone px-5 pb-24">
      <Brand />
      <Link href="/app/more" className="text-sm font-semibold text-[#10B981]">More</Link>
      <h1 className="mt-2 text-2xl font-bold">Locations</h1>
      <p className="text-slate-500">Add or disable. Keep at least one on.</p>
      <ul className="mt-4 space-y-2">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <div>
              <div className="font-semibold">{l.name}</div>
              <div className="text-sm text-slate-500">{l.address || l.kind}</div>
            </div>
            <button onClick={() => toggle(l.id, !l.active)} className="text-sm text-[#10B981]">
              {l.active ? "Disable" : "Enable"}
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-5 block text-sm">Location name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      <label className="mt-3 block text-sm">Address</label>
      <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      <label className="mt-3 block text-sm">Type</label>
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
        <option value="in_person">In person</option>
        <option value="house_call">House call</option>
        <option value="online">Online</option>
      </select>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <button disabled={busy || !name} onClick={add} className="mt-4 w-full rounded-xl bg-[#10B981] py-3 font-semibold text-white disabled:opacity-40">
        Add location
      </button>
      <TabBar active="more" />
    </main>
  );
}
