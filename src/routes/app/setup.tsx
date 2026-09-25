import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AddressAutocomplete, emptyAddress, type AddressValue } from "@/components/bookme/address-autocomplete";
import { BookAheadPicker } from "@/components/bookme/book-ahead-picker";
import { BookingShare } from "@/components/bookme/booking-share";
import { DurationPriceList } from "@/components/bookme/price-input";
import { TimezoneSelect } from "@/components/bookme/timezone-select";
import { VerticalPicker } from "@/components/bookme/vertical-picker";
import { WeeklyHoursEditor } from "@/components/bookme/weekly-hours-editor";
import { Button } from "@/components/ui/button";
import { saveCoachBasics, saveCoachHours, saveCoachLocations, startCoachTrial } from "@/lib/bookme/api";
import { DEFAULT_BOOK_AHEAD_DAYS, lastBookableDateKey, normalizeBookAheadDays } from "@/lib/bookme/book-ahead";
import { formatDateKey, todayKey } from "@/lib/bookme/time";
import type { HourSegment } from "@/lib/bookme/hours";
import { durationPricesFromInputs, initialPriceInputs, prefillDurationPrice } from "@/lib/bookme/price-input";
import { DURATIONS } from "@/lib/bookme/setup";
import { cn } from "@/lib/utils";
import { useCoach } from "@/lib/bookme/coach-context";

export const Route = createFileRoute("/app/setup")({ component: Setup });

function setupDurations(services: { duration: number; durations?: number[] }[] | undefined) {
  const svc = services?.[0];
  const fromSvc = svc?.durations;
  if (Array.isArray(fromSvc) && fromSvc.length) return [...fromSvc].sort((a, b) => a - b);
  return [svc?.duration || 60];
}

function Setup() {
  const { coach, reload } = useCoach();
  const [step, setStep] = useState(coach?.setup ? 3 : 0);
  const [name, setName] = useState(coach?.name ?? "");
  const [title, setTitle] = useState(coach?.title?.replace(/ coach/i, "") || "Tennis");
  const [durations, setDurations] = useState<number[]>(() => setupDurations(coach?.services));
  const [prices, setPrices] = useState<Record<number, string>>(() => {
    const durs = setupDurations(coach?.services);
    const svc = coach?.services[0];
    return initialPriceInputs(durs, svc ?? null, svc ? "" : "80");
  });
  const [timezone, setTimezone] = useState(coach?.timezone || "America/Toronto");
  const [locations, setLocations] = useState<
    { id?: string; name: string; kind: string; active?: boolean; addressValue: AddressValue }[]
  >(
    coach?.locations.length
      ? coach.locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          kind: loc.kind,
          active: loc.active,
          addressValue: {
            address: loc.address,
            placeId: loc.placeId ?? null,
            lat: loc.lat ?? null,
            lng: loc.lng ?? null,
            verified: !!loc.verified,
            city: null,
            timezone: null,
          },
        }))
      : [{ name: "", kind: "in_person", active: true, addressValue: emptyAddress() }],
  );
  const [hours, setHours] = useState<HourSegment[]>(
    coach?.hours.length ? coach.hours : [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 600, endMin: 1200 })),
  );
  const [bookAheadDays, setBookAheadDays] = useState(() =>
    normalizeBookAheadDays(coach?.bookAheadDays ?? DEFAULT_BOOK_AHEAD_DAYS),
  );
  const [busy, setBusy] = useState(false);
  if (!coach) return null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <p className="text-sm text-muted">Step {step + 1} of 4</p>
      <div className="mt-2 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-forest" : "bg-line")} />
        ))}
      </div>
      {step === 0 ? (
        <>
          <h1 className="mt-6 font-display text-3xl font-medium">Basics</h1>
          <p className="mt-1 text-muted">Students book from these defaults.</p>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-medium">What do you coach?</p>
            <p className="mb-3 text-sm text-muted">Sport, fitness, music, arts, or academic.</p>
            <VerticalPicker
              value={title}
              onChange={(_id, label) => setTitle(label)}
            />
          </div>
          <p className="mt-4 text-sm font-medium">Duration</p>
          <p className="mt-1 text-sm text-muted">Select one or more lesson lengths students can book.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map((d) => {
              const on = durations.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPrices((prev) => {
                      if (durations.includes(d)) return prev;
                      if (prev[d]) return prev;
                      return { ...prev, [d]: prefillDurationPrice(prev, durations) };
                    });
                    setDurations((prev) => {
                      if (prev.includes(d)) {
                        if (prev.length === 1) return prev;
                        return prev.filter((x) => x !== d);
                      }
                      return [...prev, d].sort((a, b) => a - b);
                    });
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm ring-1",
                    on ? "bg-forest text-on-forest ring-forest" : "ring-line",
                  )}
                >
                  {d} min
                </button>
              );
            })}
          </div>
          <DurationPriceList
            durations={durations}
            prices={prices}
            onChange={(minutes, value) => setPrices((prev) => ({ ...prev, [minutes]: value }))}
          />
          <div className="mt-4">
            <p id="coach-timezone-label" className="mb-1.5 text-sm font-medium">
              Timezone
            </p>
            <TimezoneSelect labelledBy="coach-timezone-label" value={timezone} onChange={setTimezone} />
          </div>
          <Button
            className="mt-6"
            size="field"
            disabled={busy || durations.length === 0 || !durationPricesFromInputs(durations, prices)}
            onClick={async () => {
              setBusy(true);
              const priced = durationPricesFromInputs(durations, prices);
              if (!durations.length || !priced) {
                setBusy(false);
                return toast.error(durations.length ? "Enter a price" : "Pick at least one duration");
              }
              const res = await saveCoachBasics({
                data: {
                  name,
                  title: `${title} Coach`,
                  durations,
                  duration: durations[0],
                  priceCad: priced.priceCad,
                  durationPrices: priced.durationPrices,
                  timezone,
                },
              });
              setBusy(false);
              if (!res.ok) return toast.error(res.error);
              reload();
              setStep(1);
            }}
          >
            Continue
          </Button>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <h1 className="mt-6 font-display text-3xl font-medium">Locations</h1>
          <p className="mt-1 text-muted">Add at least one location to publish.</p>
          {locations.map((loc, i) => (
            <div key={i} className="mt-4 space-y-2 rounded-2xl bg-card p-4 ring-1 ring-line">
              <input className="field" placeholder="Location name" value={loc.name} onChange={(e) => {
                const next = [...locations];
                next[i] = { ...loc, name: e.target.value };
                setLocations(next);
              }} />
              <AddressAutocomplete
                value={loc.addressValue}
                onChange={(addressValue) => {
                  const next = [...locations];
                  next[i] = { ...loc, addressValue };
                  setLocations(next);
                }}
              />
              <select className="field" value={loc.kind} onChange={(e) => {
                const next = [...locations];
                next[i] = { ...loc, kind: e.target.value };
                setLocations(next);
              }}>
                <option value="in_person">In person</option>
                <option value="house_call">House call</option>
                <option value="online">Online</option>
              </select>
            </div>
          ))}
          <button type="button" className="mt-3 text-sm font-semibold text-forest" onClick={() => setLocations([...locations, { name: "", kind: "in_person", active: true, addressValue: emptyAddress() }])}>
            Add location
          </button>
          <Button className="mt-6" size="field" disabled={busy} onClick={async () => {
            setBusy(true);
            const res = await saveCoachLocations({
              data: {
                locations: locations.map((loc) => ({
                  id: loc.id,
                  name: loc.name,
                  address: loc.addressValue.address,
                  kind: loc.kind,
                  active: loc.active,
                  placeId: loc.addressValue.placeId,
                  lat: loc.addressValue.lat,
                  lng: loc.addressValue.lng,
                  verified: loc.addressValue.verified,
                  city: loc.addressValue.city,
                  timezone: loc.addressValue.timezone,
                })),
              },
            });
            setBusy(false);
            if (!res.ok) return toast.error(res.error);
            reload();
            setStep(2);
          }}>
            Continue
          </Button>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <h1 className="mt-6 font-display text-3xl font-medium">Hours</h1>
          <p className="mt-1 text-muted">Repeating weekly hours. Students only see open slots.</p>
          <div className="mt-5">
            <WeeklyHoursEditor hours={hours} onChange={setHours} />
          </div>
          <h2 className="mt-8 font-display text-2xl font-medium">Booking window</h2>
          <p className="mt-1 text-muted">How far ahead students can pick a time. You can still place a lesson further out yourself.</p>
          <div className="mt-4">
            <BookAheadPicker value={bookAheadDays} onChange={setBookAheadDays} />
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Open through{" "}
            {formatDateKey(lastBookableDateKey(bookAheadDays, todayKey(timezone)))}
            .
          </p>
          <Button className="mt-6" size="field" disabled={busy} onClick={async () => {
            setBusy(true);
            const res = await saveCoachHours({ data: { hours, bookAheadDays } });
            setBusy(false);
            if (!res.ok) return toast.error(res.error);
            reload();
            setStep(3);
          }}>
            Continue
          </Button>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <h1 className="mt-6 font-display text-3xl font-medium">Your booking link</h1>
          <p className="mt-1 text-muted">Students use this to book a new lesson.</p>
          <div className="mt-5">
            <BookingShare slug={coach.slug} name={coach.name} canShare={coach.open} walletEnabled={coach.walletEnabled} />
          </div>
          {coach.open ? null : (
            <Button className="mt-6" size="field" disabled={busy} onClick={async () => {
              setBusy(true);
              const res = await startCoachTrial();
              setBusy(false);
              if (res.ok && "checkoutUrl" in res && res.checkoutUrl) {
                window.location.href = res.checkoutUrl;
                return;
              }
              reload();
              toast.success("3-day Light trial started");
            }}>
              Start 3-day Light trial
            </Button>
          )}
          <Link to="/app" className="mt-4 block text-center text-sm font-semibold text-forest">
            Go to schedule
          </Link>
          {coach.setup ? (
            <button type="button" className="mt-3 block w-full text-center text-sm text-muted" onClick={() => setStep(0)}>
              Edit details
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
