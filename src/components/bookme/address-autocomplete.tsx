import { useEffect, useRef, useState } from "react";
import { placesAutocomplete, placesDetails, placesStatus } from "@/lib/bookme/api";
import type { PlaceSuggestion } from "@/lib/bookme/places";

export type AddressValue = {
  address: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  city: string | null;
  timezone: string | null;
};

type Props = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  id?: string;
};

export function AddressAutocomplete({ value, onChange, id }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    placesStatus()
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function setManualAddress(address: string) {
    onChange({
      address,
      placeId: null,
      lat: null,
      lng: null,
      verified: false,
      city: value.city,
      timezone: value.timezone,
    });
    setApiFailed(false);
  }

  function scheduleSearch(q: string) {
    if (debounce.current) clearTimeout(debounce.current);
    if (!configured) return;
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await placesAutocomplete({ data: { q: q.trim() } });
        if (data.error) {
          setApiFailed(true);
          setSuggestions([]);
          setOpen(false);
          return;
        }
        setApiFailed(false);
        setSuggestions(data.suggestions || []);
        setOpen(true);
      } catch {
        setApiFailed(true);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 220);
  }

  async function pick(s: PlaceSuggestion) {
    setOpen(false);
    setSuggestions([]);
    try {
      const data = await placesDetails({ data: { placeId: s.placeId } });
      if (!data.ok) {
        onChange({
          address: s.description,
          placeId: s.placeId,
          lat: null,
          lng: null,
          verified: false,
          city: value.city,
          timezone: null,
        });
        setApiFailed(true);
        return;
      }
      onChange({
        address: data.formattedAddress || s.description,
        placeId: data.placeId || s.placeId,
        lat: typeof data.lat === "number" ? data.lat : null,
        lng: typeof data.lng === "number" ? data.lng : null,
        verified: true,
        city: data.city || null,
        timezone: data.timezone || null,
      });
      setApiFailed(false);
    } catch {
      onChange({
        address: s.description,
        placeId: s.placeId,
        lat: null,
        lng: null,
        verified: false,
        city: value.city,
        timezone: null,
      });
      setApiFailed(true);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        value={value.address}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={configured === false ? "Address" : "Start typing an address"}
        onChange={(e) => {
          setManualAddress(e.target.value);
          scheduleSearch(e.target.value);
        }}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        className="field mt-1"
      />
      {configured === false && <p className="mt-1 text-sm text-muted">Type the address — live search is off in this environment.</p>}
      {configured && apiFailed && (
        <p className="mt-1 text-sm text-muted">No match — enter address manually (unverified)</p>
      )}
      {configured && value.address && !value.verified && !apiFailed && !open && (
        <p className="mt-1 text-sm text-muted">Unverified address</p>
      )}
      {configured && value.verified && <p className="mt-1 text-sm text-success">Verified place</p>}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-card shadow-soft">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-sage-3"
                onClick={() => pick(s)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{s.mainText}</span>
                  {s.secondaryText ? (
                    <span className="block truncate text-sm text-muted">{s.secondaryText}</span>
                  ) : null}
                </span>
                <span className="mt-1 size-4 shrink-0 rounded-full border-2 border-forest" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && <span className="sr-only">Searching</span>}
    </div>
  );
}

export const emptyAddress = (): AddressValue => ({
  address: "",
  placeId: null,
  lat: null,
  lng: null,
  verified: false,
  city: null,
  timezone: null,
});
