import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Repeat } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CollectButton } from "@/components/bookme/collect-button";
import { MessageLink } from "@/components/bookme/message-link";
import { PayChip, StatusChip } from "@/components/bookme/pay-chip";
import { useCoachWeather } from "@/components/bookme/use-lesson-weather";
import { WeatherChip } from "@/components/bookme/weather-chip";
import { Button } from "@/components/ui/button";
import { coachCancelLesson, coachMoveLesson, coachNextWeek, getCoachOpenSlots, getMyLesson } from "@/lib/bookme/api";
import { notifyLessonsChanged, useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { parseClock } from "@/lib/bookme/recurring";
import { LessonScan, lessonInstantParts } from "@/components/bookme/lesson-scan";
import { formatTime, zonedInstantExact } from "@/lib/bookme/time";

export const Route = createFileRoute("/app/lessons/$id")({ component: LessonDetail });

function LessonDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { byId: weatherByLesson, reload: reloadWeather } = useCoachWeather();
  const [data, setData] = useState<Extract<Awaited<ReturnType<typeof getMyLesson>>, { ok: true }> | null>(null);
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [otherTime, setOtherTime] = useState("");
  const [pendingOutside, setPendingOutside] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const idRef = useRef(id);
  idRef.current = id;

  function reload() {
    const lessonId = id;
    return getMyLesson({ data: { id: lessonId } }).then((r) => {
      if (idRef.current !== lessonId || !r.ok) return;
      setData(r);
    });
  }

  useLessonsRefresh(reload);

  useEffect(() => {
    const lessonId = id;
    getMyLesson({ data: { id: lessonId } }).then((r) => {
      if (idRef.current !== lessonId || !r.ok) return;
      setData(r);
      setDay(r.today);
    });
  }, [id]);

  useEffect(() => {
    if (!data || !day) return;
    getCoachOpenSlots({ data: { date: day, duration: data.lesson.duration } }).then((d) => setSlots(d.slots));
  }, [data, day]);

  if (!data) return <div className="p-8 text-muted">Loading…</div>;
  const l = data.lesson;
  const tz = data.timezone;
  const movable = l.status === "confirmed" || l.status === "held";
  const canCollect = l.status === "confirmed" && (l.pay.kind === "unpaid" || l.pay.kind === "series");

  async function move(start: string, allowOutsideHours = false) {
    setBusy(true);
    const res = await coachMoveLesson({ data: { lessonId: id, start, allowOutsideHours } });
    setBusy(false);
    if (!res.ok && res.outsideHours) {
      setPendingOutside(start);
      setMsg("");
      return;
    }
    setPendingOutside(null);
    setMsg(res.ok ? "Lesson updated." : res.error);
    if (res.ok) {
      setOtherTime("");
      notifyLessonsChanged("reschedule");
      void reload();
    }
  }

  function otherStart() {
    const minutes = parseClock(otherTime);
    if (minutes == null || !day) return null;
    return zonedInstantExact(day, minutes, tz)?.toISOString() ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link to="/app" className="type-action text-sm font-semibold text-forest">
        Schedule
      </Link>
      <h1 className="type-page mt-3 font-display text-3xl font-medium">Lesson</h1>
      <div className="mt-4 rounded-2xl bg-card p-5 ring-1 ring-line">
        <div className="max-md:hidden">
          <p className="type-primary break-words font-semibold">{l.when}</p>
          <p className="type-primary break-words">Private · {l.clientName}</p>
          <p className="break-words text-sm text-muted">{l.clientEmail || "No email on file"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words text-sm text-muted">{l.locationName}</p>
            <WeatherChip
              view={weatherByLesson[id]}
              audience="coach"
              onResolved={(decision) => {
                if (decision === "cancel") {
                  notifyLessonsChanged("weather-cancel");
                  void navigate({ to: "/app" });
                } else void reloadWeather();
              }}
            />
          </div>
        </div>
        <LessonScan
          label="Lesson"
          time={lessonInstantParts(l.start, tz).time}
          name={l.clientName}
          date={lessonInstantParts(l.start, tz).date}
          location={l.locationName}
          extra={
            <p className="type-secondary mt-0.5 break-words text-muted">{l.clientEmail || "No email on file"}</p>
          }
        />
        <div className="mt-2 md:hidden">
          <WeatherChip
            view={weatherByLesson[id]}
            audience="coach"
            onResolved={(decision) => {
              if (decision === "cancel") {
                notifyLessonsChanged("weather-cancel");
                void navigate({ to: "/app" });
              } else void reloadWeather();
            }}
          />
        </div>
        <p className="mt-2 text-sm">
          {l.duration} min · <StatusChip>{l.statusLabel}</StatusChip>
        </p>
        <p className="mt-2">
          <PayChip kind={l.pay.kind} text={l.pay.text} />
        </p>
        {l.recurring && l.seriesId ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <Repeat className="size-4 shrink-0 text-forest" strokeWidth={1.75} />
            <span className="min-w-0 break-words">
              Part of a recurring schedule ·{" "}
              <Link to="/app/series/$id" params={{ id: l.seriesId }} className="font-semibold text-forest underline">
                Open schedule
              </Link>
            </span>
          </p>
        ) : null}
        <MessageLink clientId={l.clientId} />
        {l.pendingKind ? (
          <p className="mt-3 break-words text-sm font-semibold text-forest">
            {l.pendingKind === "coach_swap" ? "A time swap is waiting on the students." : "This student asked to move. Review it in Bookings."}{" "}
            <Link to="/app/bookings" search={{ tab: "requests", swap: undefined }} className="underline">
              Open requests
            </Link>
          </p>
        ) : null}
        {canCollect ? (
          <div className="mt-3">
            <CollectButton
              lessonId={id}
              onCollected={() => {
                notifyLessonsChanged("collect");
                void reload();
              }}
            />
            {l.recurring ? <p className="mt-2 text-xs text-muted">Only this lesson is marked. The schedule's payment note stays as is.</p> : null}
          </div>
        ) : null}
      </div>
      {movable ? (
        <div className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-line">
          <h2 className="type-section font-semibold">Reschedule</h2>
          <p className="mt-1 text-sm text-muted">
            {l.recurring
              ? "Pick an open time, or any other time — including outside your public hours."
              : "You can pick any open time. The student booking window does not apply."}{" "}
            Times are in {tz}.
          </p>
          <input className="field mt-3" type="date" min={data.today} value={day} onChange={(e) => setDay(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                className="rounded-xl px-3 py-2 text-sm ring-1 ring-line hover:bg-sage-3"
                onClick={() => void move(s)}
              >
                {formatTime(new Date(s), tz)}
              </button>
            ))}
            {slots.length === 0 ? <p className="text-sm text-muted">No open times this day.</p> : null}
          </div>
          {l.recurring ? (
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="block w-full min-w-0 max-w-full flex-1 md:w-auto md:flex-none">
                <span className="mb-1.5 block text-sm font-medium">Other time</span>
                <input className="field max-w-full" type="time" step={300} value={otherTime} onChange={(e) => setOtherTime(e.target.value)} />
              </label>
              <Button
                variant="outline"
                size="field"
                className="min-w-0 max-w-full"
                disabled={busy || !otherStart()}
                onClick={() => {
                  const start = otherStart();
                  if (start) void move(start);
                }}
              >
                Move here
              </Button>
            </div>
          ) : null}
          {pendingOutside ? (
            <div className="mt-4 rounded-xl bg-paper-2 p-3 text-sm">
              <p className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={1.75} />
                <span className="min-w-0 break-words">
                  Not in your public hours — this will still hold the slot. Move to {formatTime(new Date(pendingOutside), tz)}?
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="field" className="w-auto min-w-0 max-w-full flex-[1_1_12rem]" disabled={busy} onClick={() => void move(pendingOutside, true)}>
                  Move anyway
                </Button>
                <Button variant="outline" size="field" className="w-auto min-w-0 max-w-full flex-[1_1_12rem]" disabled={busy} onClick={() => setPendingOutside(null)}>
                  Keep current time
                </Button>
              </div>
            </div>
          ) : null}
          {l.status === "confirmed" && !l.recurring ? (
            <Button
              variant="outline"
              className="mt-4"
              size="field"
              onClick={async () => {
                const res = await coachNextWeek({ data: { lessonId: id } });
                setMsg(res.ok ? "Booked same time next week." : res.error);
                if (res.ok) notifyLessonsChanged("book");
              }}
            >
              Book same time next week
            </Button>
          ) : null}
          {!l.recurring ? (
            <Button variant="outline" className="mt-3" size="field" asChild>
              <Link to="/app/bookings" search={{ tab: "requests", swap: id }}>
                Propose a swap
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="mt-3 text-coral"
            size="field"
            onClick={async () => {
              const res = await coachCancelLesson({ data: { lessonId: id } });
              if (res.ok) {
                notifyLessonsChanged("cancel");
                void navigate({ to: "/app" });
              } else setMsg(res.error);
            }}
          >
            {l.recurring ? "Cancel this lesson only" : "Cancel lesson"}
          </Button>
        </div>
      ) : null}
      {msg ? <p className="mt-4 text-sm text-ink-soft">{msg}</p> : null}
    </div>
  );
}
