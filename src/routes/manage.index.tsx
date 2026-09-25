import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudentWeather } from "@/components/bookme/use-lesson-weather";
import { WeatherChip } from "@/components/bookme/weather-chip";
import {
  decideRequest,
  getOpenSlots,
  studentChangeLesson,
  studentLessons,
  studentListRequests,
  studentRequestMove,
} from "@/lib/bookme/api";
import { canSelfReschedule } from "@/lib/bookme/hold";
import { useStudent } from "@/lib/bookme/student-context";
import { formatTime } from "@/lib/bookme/time";

export const Route = createFileRoute("/manage/")({ component: StudentLessons });

type Lessons = NonNullable<Extract<Awaited<ReturnType<typeof studentLessons>>, { ok: true }>["lessons"]>;
type Requests = NonNullable<Extract<Awaited<ReturnType<typeof studentListRequests>>, { ok: true }>["requests"]>;

function StudentLessons() {
  const { signedOut } = useStudent();
  const { byId: weatherByLesson, reload: reloadWeather } = useStudentWeather();
  const [lessons, setLessons] = useState<Lessons>([]);
  const [requests, setRequests] = useState<Requests>([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<Lessons[number] | null>(null);
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [lastDate, setLastDate] = useState("");
  const [askStart, setAskStart] = useState("");
  const [askNote, setAskNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const pending = requests.filter((r) => r.status === "pending");
  const pendingLessonIds = new Set(pending.map((r) => r.lessonId));

  async function load() {
    const data = await studentLessons();
    if (!data.ok) return signedOut();
    setLessons(data.lessons);
    setLoaded(true);
    const req = await studentListRequests();
    if (req.ok) setRequests(req.requests);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!picked || !day) return;
    getOpenSlots({ data: { slug: picked.coachSlug, date: day } }).then((d) => {
      setSlots(d.slots);
      if (d.lastDate) setLastDate(d.lastDate);
    });
  }, [picked, day]);

  async function act(action: "cancel" | "reschedule", start?: string) {
    if (!picked) return;
    const res = await studentChangeLesson({ data: { lessonId: picked.id, action, start } });
    if (!res.ok) return setMsg(res.error);
    setMsg(action === "cancel" ? "Cancelled." : "Rescheduled.");
    setPicked(null);
    setAskStart("");
    await load();
  }

  async function askCoach() {
    if (!picked || !askStart) return;
    setBusy(true);
    const res = await studentRequestMove({ data: { lessonId: picked.id, start: askStart, note: askNote } });
    setBusy(false);
    if (!res.ok) return setMsg(res.error);
    setMsg("Request sent to your coach. You'll get an email when they reply.");
    setPicked(null);
    setAskStart("");
    setAskNote("");
    await load();
  }

  async function decide(token: string, decision: "accepted" | "declined") {
    setBusy(true);
    const res = await decideRequest({ data: { token, decision } });
    setBusy(false);
    setMsg(res.ok ? res.message : res.error);
    await load();
  }

  // Regular weekly lessons can't be moved by the student; they can cancel or ask.
  const selfServe = picked ? canSelfReschedule(new Date(picked.start)) && !picked.recurring : false;

  if (!loaded) return <p className="mt-6 text-muted">Loading…</p>;

  return (
    <>
      <p className="mt-5 text-sm text-muted">Free reschedule until 24 hours before. After that, send a request — your coach decides.</p>
      {pending.length ? (
        <ul className="mt-5 space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-2xl bg-sage-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-forest">
                {r.kind === "coach_swap" ? "Coach asked to swap" : "Waiting on your coach"}
              </p>
              <p className="mt-1 font-semibold">{r.coachName}</p>
              <p className="text-sm">
                {r.kind === "coach_swap"
                  ? `Your lesson ${r.when} ⇄ ${r.otherLabel ?? "Another student"} · ${r.otherWhen}`
                  : `Move ${r.when} to ${r.nextWhen}`}
              </p>
              {r.note ? <p className="mt-2 text-sm text-ink-soft">{r.note}</p> : null}
              {r.canDecide && r.token ? (
                <div className="mt-3 grid gap-2">
                  <Button size="field" disabled={busy} onClick={() => void decide(r.token!, "accepted")}>
                    Accept swap
                  </Button>
                  <Button variant="outline" size="field" disabled={busy} onClick={() => void decide(r.token!, "declined")}>
                    Keep my time
                  </Button>
                </div>
              ) : r.token ? (
                <Link to="/r/$token" params={{ token: r.token }} className="mt-2 inline-block text-sm font-semibold text-forest">
                  Review
                </Link>
              ) : (
                <p className="mt-2 text-xs text-muted">You’ll get an email when they reply.</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-5 space-y-3">
        {lessons.map((l) => (
          <li key={l.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{l.coachName}</p>
              {l.coachSlug ? (
                <Link
                  to="/$slug"
                  params={{ slug: l.coachSlug }}
                  className="shrink-0 rounded-full bg-forest px-3 py-1.5 text-sm font-semibold text-on-forest"
                >
                  Book a new lesson
                </Link>
              ) : null}
            </div>
            <p className="text-sm">{l.when}</p>
            <p className="text-sm text-muted">{l.locationName}</p>
            <p className="text-sm text-muted">
              {l.status} · {l.payText}
            </p>
            <WeatherChip
              view={weatherByLesson[l.id]}
              audience="student"
              onResolved={() => {
                void reloadWeather();
                void load();
              }}
            />
            {pendingLessonIds.has(l.id) ? (
              <p className="mt-2 text-sm font-semibold text-forest">A change is already waiting.</p>
            ) : l.confirmed ? (
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-forest"
                onClick={() => {
                  setPicked(l);
                  setDay(l.today);
                  setAskStart("");
                }}
              >
                {l.recurring ? "Cancel or ask your coach" : "Reschedule or ask your coach"}
              </button>
            ) : null}
          </li>
        ))}
        {lessons.length === 0 ? (
          <li>
            <p className="text-muted">No bookings for this email.</p>
            <p className="mt-2 text-sm text-muted">
              Ask your coach for their booking link, or{" "}
              <Link to="/find" className="font-semibold text-forest">
                find a coach
              </Link>
              .
            </p>
          </li>
        ) : null}
      </ul>
      {picked ? (
        <div className="mt-6 rounded-2xl bg-card p-4 ring-1 ring-line">
          <h2 className="font-display text-2xl">Change this lesson</h2>
          <p className="mt-1 text-sm text-muted">
            {picked.recurring
              ? "This is one of your regular weekly lessons. Ask your coach for a new time, or cancel this one."
              : selfServe
                ? "More than 24 hours away — you can move it now, or send a request."
                : "Inside 24 hours. Send a request with a note — your coach decides."}
          </p>
          <input
            className="field mt-3"
            type="date"
            value={day}
            min={picked.today}
            max={lastDate || undefined}
            onChange={(e) => setDay(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                className={
                  askStart === s
                    ? "rounded-xl bg-forest px-3 py-2 text-sm text-on-forest"
                    : "rounded-xl px-3 py-2 text-sm ring-1 ring-line hover:bg-sage-3"
                }
                onClick={() => setAskStart(s)}
              >
                {formatTime(new Date(s), picked.timezone)}
              </button>
            ))}
            {slots.length === 0 ? <p className="text-sm text-muted">No open times this day.</p> : null}
          </div>
          {askStart ? (
            <div className="mt-4">
              <label className="text-sm font-medium">Note for your coach</label>
              <textarea
                className="field mt-1 h-24 py-3"
                value={askNote}
                onChange={(e) => setAskNote(e.target.value)}
                placeholder="Why you need to move…"
              />
              {selfServe ? (
                <Button className="mt-3" size="field" disabled={busy} onClick={() => void act("reschedule", askStart)}>
                  Move now
                </Button>
              ) : null}
              <Button className="mt-3" variant={selfServe ? "outline" : "primary"} size="field" disabled={busy} onClick={() => void askCoach()}>
                Send request
              </Button>
            </div>
          ) : null}
          <Button variant="outline" className="mt-4 text-coral" size="field" onClick={() => void act("cancel")}>
            Cancel lesson
          </Button>
        </div>
      ) : null}
      {msg ? <p className="mt-4 text-sm text-ink-soft">{msg}</p> : null}
    </>
  );
}
