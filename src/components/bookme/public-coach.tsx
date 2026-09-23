import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { CalendarDays, Clock, Lock, MapPin } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { MonthCal } from "@/components/bookme/month-cal";
import { PageShell } from "@/components/page-shell";
import { SportIcon } from "@/components/sport-icon";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/not-found";
import { SPORT_LABEL, labelForDate } from "@/lib/coaches";
import { getOpenSlots, getPublicCoach, recordVisit, ensureDemoCoach } from "@/lib/bookme/api";
import { asSport } from "@/lib/bookme/sport";
import { DEMO_COACH } from "@/lib/bookme/demo";
import { datesFromToday, formatDateKey, formatTime, todayKey } from "@/lib/bookme/time";
import { lastBookableDateKey } from "@/lib/bookme/book-ahead";
import { cn, formatMoney, parseISODate } from "@/lib/utils";

export function CoachPage({
  initialCoach,
  slug: slugProp,
}: {
  initialCoach?: Awaited<ReturnType<typeof getPublicCoach>> | null;
  slug?: string;
} = {}) {
  const params = useParams({ strict: false }) as { slug?: string };
  const slug = slugProp || initialCoach?.slug || params.slug || "";
  const [coach, setCoach] = useState<Awaited<ReturnType<typeof getPublicCoach>> | undefined>(
    initialCoach ?? undefined,
  );
  const [missing, setMissing] = useState(initialCoach === null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (initialCoach) return;
      let c = await getPublicCoach({ data: { slug } });
      if (!c && slug === DEMO_COACH.slug) {
        await ensureDemoCoach();
        c = await getPublicCoach({ data: { slug: DEMO_COACH.slug } });
      }
      if (!live) return;
      if (!c) setMissing(true);
      else setCoach(c);
    })();
    const visitorId = localStorage.getItem("bookme.vid") || "";
    recordVisit({ data: { visitorId } }).then((r) => {
      localStorage.setItem("bookme.vid", r.visitorId);
    });
    return () => {
      live = false;
    };
  }, [slug, initialCoach]);

  if (missing) return <NotFound />;
  if (!coach) {
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl px-5 py-24 text-muted">Loading…</div>
      </PageShell>
    );
  }
  return <CoachView coach={coach} />;
}

function CoachView({ coach }: { coach: NonNullable<Awaited<ReturnType<typeof getPublicCoach>>> }) {
  const navigate = useNavigate();
  const bookAheadDays = coach.bookAheadDays;
  const tz = coach.timezone;
  const today = todayKey(tz);
  const lastDate = lastBookableDateKey(bookAheadDays, today);
  const dates = datesFromToday(Math.min(8, Math.max(2, bookAheadDays)), tz);
  const [lessonId, setLessonId] = useState(coach.services[0]?.id ?? "");
  const [locationId, setLocationId] = useState(coach.locations.length === 1 ? coach.locations[0]?.id ?? "" : "");
  const [date, setDate] = useState(dates[0] ?? "");
  const [picked, setPicked] = useState("");
  const [slots, setSlots] = useState<string[]>([]);

  const lesson = coach.services.find((l) => l.id === lessonId) ?? coach.services[0];
  const lessonDurations: number[] = (() => {
    const raw = (lesson as { durations?: number[] } | undefined)?.durations;
    if (Array.isArray(raw) && raw.length) return [...raw].sort((a, b) => a - b);
    return [lesson?.duration || 60];
  })();
  const [duration, setDuration] = useState(lessonDurations[0] ?? 60);
  useEffect(() => {
    if (!lessonDurations.includes(duration)) {
      setDuration(lessonDurations[0] ?? 60);
    }
  }, [lessonId, lessonDurations.join(","), duration]);
  const location = coach.locations.find((l) => l.id === locationId) ?? coach.locations[0];
  const sport = asSport(coach.sport);
  const datePair = dates.slice(0, 2);

  useEffect(() => {
    if (!date || !lesson) return;
    setPicked("");
    getOpenSlots({ data: { slug: coach.slug, date, duration } }).then((d) => {
      setSlots(d.slots);
    });
  }, [coach.slug, date, lesson, duration]);

  function continueBook() {
    if (!lesson || !picked) return;
    if (coach.locations.length > 1 && !locationId) return;
    const loc = location ?? coach.locations[0];
    if (!loc) return;
    void navigate({
      to: "/book/$slug",
      params: { slug: coach.slug },
      search: { start: picked, location: loc.id, service: lesson.id, duration },
    });
  }

  return (
    <PageShell>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-8 pt-8 sm:px-8 lg:grid-cols-[1.15fr_0.95fr] lg:items-start lg:pt-10">
        <div className="relative overflow-hidden rounded-3xl bg-sage-3">
          {coach.photoUrl ? (
            <img
              src={coach.photoUrl}
              alt={coach.name}
              className="aspect-[4/3] w-full object-cover object-[28%_center] lg:aspect-[5/4]"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center font-display text-6xl text-forest">
              {coach.name.slice(0, 1)}
            </div>
          )}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] bg-gradient-to-l from-paper from-35% to-transparent lg:block" />
          <div className="absolute bottom-8 right-8 hidden text-right lg:block">
            <h1 className="font-display text-5xl font-medium">{coach.name}</h1>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-3 px-3 py-1.5 text-sm font-medium text-forest">
              <SportIcon sport={sport} />
              {SPORT_LABEL[sport]}
            </span>
          </div>
        </div>
        <div className="lg:hidden">
          <h1 className="font-display text-4xl font-medium">{coach.name}</h1>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-3 px-3 py-1.5 text-sm font-medium text-forest">
            <SportIcon sport={sport} />
            {SPORT_LABEL[sport]}
          </span>
        </div>

        <aside className="rounded-2xl bg-card p-5 shadow-soft ring-1 ring-line sm:p-6">
          <h2 className="font-display text-2xl font-medium">Choose a lesson</h2>
          {!coach.open ? (
            <p className="mt-4 text-sm text-muted">This coach is not taking new bookings right now.</p>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {coach.services.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLessonId(l.id);
                      setPicked("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left ring-1 transition-colors",
                      l.id === lessonId ? "bg-sage-3 text-forest ring-forest" : "bg-card ring-line hover:bg-paper",
                    )}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{l.name}</span>
                      <span className="text-xs text-muted">
                        {(() => {
                          const ds = Array.isArray((l as { durations?: number[] }).durations) && (l as { durations?: number[] }).durations!.length
                            ? [...(l as { durations: number[] }).durations].sort((a, b) => a - b)
                            : [l.duration];
                          return ds.length === 1 ? `${ds[0]} min` : `${ds[0]}–${ds[ds.length - 1]} min`;
                        })()}
                      </span>
                    </span>
                    <span className="font-semibold">{formatMoney(l.priceCad).replace(".00", "")}</span>
                  </button>
                ))}
              </div>

              {lessonDurations.length > 1 ? (
                <>
                  <h3 className="mt-6 text-sm font-semibold">Duration</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lessonDurations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDuration(d);
                          setPicked("");
                        }}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm ring-1",
                          duration === d ? "bg-forest text-on-forest ring-forest" : "ring-line",
                        )}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {coach.locations.length > 1 ? (
                <>
                  <h3 className="mt-6 text-sm font-semibold">Select location</h3>
                  <div className="relative mt-2">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="h-12 w-full appearance-none rounded-xl border border-line bg-card pl-10 pr-4 text-sm outline-none ring-forest/30 focus:ring-2"
                    >
                      <option value="">Choose a location</option>
                      {coach.locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">{coach.locations[0]?.name}</p>
              )}

              <h3 className="mt-6 text-sm font-semibold">Choose a date</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {datePair.map((d) => {
                  const meta = labelForDate(d);
                  const active = d === date;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDate(d);
                        setPicked("");
                      }}
                      className={cn(
                        "rounded-xl px-3 py-3 text-left ring-1 transition-colors",
                        active ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper",
                      )}
                    >
                      <div className="text-sm font-semibold">{meta.kicker}</div>
                      <div className={cn("text-xs", active ? "text-on-forest/80" : "text-muted")}>{meta.sub}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {dates.slice(2).map((d) => {
                  const active = d === date;
                  const dt = parseISODate(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDate(d);
                        setPicked("");
                      }}
                      className={cn(
                        "min-w-[4.5rem] rounded-xl px-2 py-2 text-center text-xs ring-1",
                        active ? "bg-forest text-on-forest ring-forest" : "ring-line",
                      )}
                    >
                      <div className="font-semibold">{dt.toLocaleDateString("en-CA", { weekday: "short" })}</div>
                      <div>{dt.getDate()}</div>
                    </button>
                  );
                })}
              </div>
              <MonthCal value={date} onChange={(d) => { setDate(d); setPicked(""); }} max={lastDate} today={today} />
              <p className="mt-2 text-xs text-muted">
                Times open through{" "}
                {formatDateKey(lastDate)}
                .
              </p>

              <h3 className="mt-6 text-sm font-semibold">Available times</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPicked(s)}
                    className={cn(
                      "h-11 min-w-[5.5rem] rounded-xl px-3 text-sm font-semibold ring-1 transition-colors",
                      picked === s ? "bg-forest text-on-forest ring-forest" : "bg-card ring-line hover:bg-paper",
                    )}
                  >
                    {formatTime(new Date(s), tz)}
                  </button>
                ))}
                {slots.length === 0 ? <p className="text-sm text-muted">No open times this day.</p> : null}
              </div>

              <Button className="mt-6" size="field" disabled={!picked || (coach.locations.length > 1 && !locationId)} onClick={continueBook}>
                Continue to book
                <span aria-hidden>→</span>
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
                <Lock className="size-3.5" />
                Confirm now · Free reschedule until 24 hours
              </p>
            </>
          )}
          <p className="mt-4 text-center text-sm">
            <Link to="/manage" className="font-semibold text-forest">
              Already booked? Manage your lesson
            </Link>
          </p>
        </aside>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 border-t border-line px-5 py-12 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-medium">Lesson details</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Fact icon={<SportIcon sport={sport} className="size-5" />} title={lesson?.name ?? "Private"} body="One-on-one coaching" />
            <Fact icon={<Clock className="size-5" />} title={`${duration} minutes`} body="Focused, personalized instruction" />
            <Fact icon={<MapPin className="size-5" />} title={location?.name ?? ""} body={location?.address ?? coach.city} />
          </div>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted">{coach.bio}</p>
          {coach.languages ? <p className="mt-3 text-sm text-ink-soft">{coach.languages}</p> : null}
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">Before you book</h2>
          <ul className="mt-5 space-y-4">
            {(coach.notes.length ? coach.notes : ["Free cancellation up to 24 hours before your lesson."]).map((n) => (
              <li key={n} className="flex gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-3 text-forest">
                  {n.toLowerCase().includes("cancel") ? <CalendarDays className="size-4" /> : <SportIcon sport={sport} />}
                </span>
                <p className="pt-2 text-sm text-ink-soft">{n}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}

function Fact({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-sage-3 text-forest">{icon}</span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}
