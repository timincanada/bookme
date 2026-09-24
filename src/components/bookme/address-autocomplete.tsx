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

const EMPTY_NOTICE = "No matching addresses. You can keep what you typed and save it unverified.";
const FAIL_NOTICE = "Address search failed. You can keep what you typed and save it unverified.";
const MANUAL_NOTICE = "This address will be saved unverified, without a map pin.";

export function AddressAutocomplete({ value, onChange, id }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchGen = useRef(0);
  const pendingQuery = useRef<string | null>(null);

  useEffect(() => {
    placesStatus()
      .then((d) => {
        const on = Boolean(d.configured);
        setConfigured(on);
        const pending = pendingQuery.current;
        if (on && pending) scheduleSearch(pending, true);
      })
      .catch(() => setConfigured(false));
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setNotice("");
  }

  function keepTypedAddress() {
    setOpen(false);
    setSuggestions([]);
    onChange({
      address: value.address,
      placeId: null,
      lat: null,
      lng: null,
      verified: false,
      city: value.city,
      timezone: value.timezone,
    });
    setNotice(value.address.trim() ? MANUAL_NOTICE : "");
  }

  function scheduleSearch(q: string, enabled = configured === true) {
    if (debounce.current) clearTimeout(debounce.current);
    searchGen.current += 1;
    if (!enabled) {
      pendingQuery.current = q.trim().length >= 2 ? q : null;
      return;
    }
    pendingQuery.current = null;
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      setNotice("");
      return;
    }
    const gen = searchGen.current;
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await placesAutocomplete({ data: { q: q.trim() } });
        if (gen !== searchGen.current) return;
        if (data.configured === false) {
          setConfigured(false);
          setSuggestions([]);
          setOpen(false);
          return;
        }
        const found = data.suggestions || [];
        if (data.error || found.length === 0) {
          setSuggestions([]);
          setOpen(true);
          setNotice(data.error ? FAIL_NOTICE : EMPTY_NOTICE);
          return;
        }
        setNotice("");
        setSuggestions(found);
        setOpen(true);
      } catch {
        if (gen !== searchGen.current) return;
        setSuggestions([]);
        setOpen(true);
        setNotice(FAIL_NOTICE);
      } finally {
        if (gen === searchGen.current) setSearching(false);
      }
    }, 220);
  }

  async function pick(s: PlaceSuggestion) {
    setOpen(false);
    setSuggestions([]);
    try {
      const data = await placesDetails({ data: { placeId: s.placeId } });
      const lat = data.ok && typeof data.lat === "number" ? data.lat : null;
      const lng = data.ok && typeof data.lng === "number" ? data.lng : null;
      if (!data.ok || lat == null || lng == null) {
        onChange({
          address: s.description,
          placeId: null,
          lat: null,
          lng: null,
          verified: false,
          city: value.city,
          timezone: value.timezone,
        });
        setNotice(FAIL_NOTICE);
        return;
      }
      onChange({
        address: data.formattedAddress || s.description,
        placeId: data.placeId || s.placeId,
        lat,
        lng,
        verified: true,
        city: data.city || null,
        timezone: data.timezone || null,
      });
      setNotice("");
    } catch {
      onChange({
        address: s.description,
        placeId: null,
        lat: null,
        lng: null,
        verified: false,
        city: value.city,
        timezone: value.timezone,
      });
      setNotice(FAIL_NOTICE);
    }
  }

  const showEmptyPanel = open && suggestions.length === 0 && !searching && Boolean(notice);

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
          if (suggestions.length || notice) setOpen(true);
        }}
        className="field mt-1"
      />
      {configured === false && (
        <p className="mt-1 text-sm text-muted">Type the address. Live search is off in this environment, so it will be saved unverified.</p>
      )}
      {searching && <p className="mt-1 text-sm text-muted">Searching addresses…</p>}
      {configured && !open && notice && <p className="mt-1 text-sm text-muted">{notice}</p>}
      {configured && value.address && !value.verified && !notice && !open && !searching && (
        <p className="mt-1 text-sm text-muted">Unverified address. Pick a match to save the map location, or keep this text.</p>
      )}
      {configured && value.verified && <p className="mt-1 text-sm text-success">Verified place</p>}
      {showEmptyPanel && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-card p-3 shadow-soft">
          <p className="text-sm text-ink">{notice}</p>
          {value.address.trim() ? (
            <button type="button" className="mt-2 text-sm font-semibold text-forest" onClick={keepTypedAddress}>
              Use this address
            </button>
          ) : null}
        </div>
      )}
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
