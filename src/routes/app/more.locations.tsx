import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AddressAutocomplete, emptyAddress, type AddressValue } from "@/components/bookme/address-autocomplete";
import { Button } from "@/components/ui/button";
import { addCoachLocation, setLocationActive } from "@/lib/bookme/api";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/more/locations")({ component: LocationsPage });

function LocationsPage() {
  const { coach, reload } = useCoach();
  const [name, setName] = useState("");
  const [address, setAddress] = useState<AddressValue>(emptyAddress());
  const [kind, setKind] = useState("in_person");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!coach) return null;

  async function add() {
    setBusy(true);
    setError("");
    const res = await addCoachLocation({
      data: {
        name,
        address: address.address,
        kind,
        placeId: address.placeId,
        lat: address.lat,
        lng: address.lng,
        verified: address.verified,
        city: address.city,
        timezone: address.timezone,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    setAddress(emptyAddress());
    reload();
  }

  async function toggle(id: string, active: boolean) {
    setError("");
    const res = await setLocationActive({ data: { id, active } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    reload();
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app/more" className="type-action text-sm font-semibold text-forest">
        More
      </Link>
      <h1 className="type-page mt-3 font-display text-3xl font-medium">Locations</h1>
      <p className="mt-2 text-muted">Add or disable. Keep at least one on.</p>
      <ul className="mt-5 space-y-2">
        {coach.locations.map((loc) => (
          <li key={loc.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
            <div>
              <p className="type-key font-semibold">{loc.name}</p>
              <p className="type-secondary text-sm text-muted">
                {loc.address || loc.kind}
                {loc.verified === false && loc.address ? " · unverified" : ""}
                {loc.active ? "" : " · off"}
              </p>
            </div>
            <button type="button" className="text-sm font-semibold text-forest" onClick={() => toggle(loc.id, !loc.active)}>
              {loc.active ? "Disable" : "Enable"}
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium">Location name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio A" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Address</span>
        <AddressAutocomplete value={address} onChange={setAddress} />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Type</span>
        <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="in_person">In person</option>
          <option value="house_call">House call</option>
          <option value="online">Online</option>
        </select>
      </label>
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <Button className="mt-6" size="field" disabled={busy || !name.trim()} onClick={add}>
        {busy ? "Adding…" : "Add location"}
      </Button>
    </div>
  );
}
