import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MonthCalendar, nextLessonDay, type CalLesson } from "@/components/bookme/lesson-calendar";
import { useCoachWeather } from "@/components/bookme/use-lesson-weather";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  coachDecideMoveRequest,
  coachProposeSwap,
  coachWithdrawRequest,
  listCoachRequests,
  listMyLessons,
} from "@/lib/bookme/api";
import { notifyLessonsChanged, useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { firstName } from "@/lib/bookme/requests";
import { todayKey } from "@/lib/bookme/time";
import { DEFAULT_TIMEZONE } from "@/lib/bookme/timezone";
import { cn } from "@/lib/utils";
import { useCoach } from "@/lib/bookme/coach-context";

type Tab = "upcoming" | "requests" | "completed" | "cancelled";

const PENDING_REQUEST_RE = /already has a pending request/i;

export const Route = createFileRoute("/app/bookings")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "completed" || s.tab === "cancelled" || s.tab === "requests" ? (s.tab as Tab) : "upcoming",
    swap: typeof s.swap === "string" ? s.swap : undefined,
  }),
  component: Bookings,
});

function Bookings() {
  const { tab, swap } = Route.useSearch();
  const { coach, reload: reloadCoach } = useCoach();
  const { byId: weatherByLesson, reload: reloadWeather } = useCoachWeather();
  const [lessons, setLessons] = useState<CalLesson[]>([]);
  const [inbox, setInbox] = useState<Extract<Awaited<ReturnType<typeof listCoachRequests>>, { ok: true }> | null>(null);
  const [aId, setAId] = useState(swap || "");
  const [bId, setBId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pendingConflict, setPendingConflict] = useState<string | null>(null);
  const [swapSentOpen, setSwapSentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = coach?.timezone || DEFAULT_TIMEZONE;
  const [day, setDay] = useState(() => todayKey(tz));
  const snapped = useRef(false);

  function reload() {
    listMyLessons().then((r) => {
      if (!r.ok) return;
      setLessons(r.lessons);
      if (!snapped.current) {
        snapped.current = true;
        setDay(nextLessonDay(r.lessons.filter((l) => l.bucket === "upcoming"), r.timezone));
      }
    });
    listCoachRequests().then((r) => {
      if (r.ok) setInbox(r);
    });
    reloadCoach();
  }

  useLessonsRefresh(reload);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (swap) setAId(swap);
  }, [swap]);

  const upcoming = useMemo(
    () => lessons.filter((l) => l.bucket === "upcoming" && (l.status === "confirmed" || l.status === "held")),
    [lessons],
  );
  const calendarLessons = useMemo(
    () => (tab === "upcoming" || tab === "completed" || tab === "cancelled" ? lessons.filter((l) => l.bucket === tab) : lessons),
    [lessons, tab],
  );

  if (!coach) return null;

  async function sendSwap() {
    if (!aId || !bId) return;
    setBusy(true);
    const res = await coachProposeSwap({ data: { lessonAId: aId, lessonBId: bId, note } });
    setBusy(false);
    if (res.ok) {
      setMsg("");
      setPendingConflict(null);
      setSwapSentOpen(true);
      setNote("");
      setBId("");
      notifyLessonsChanged("swap");
      reload();
      return;
    }
    if (PENDING_REQUEST_RE.test(res.error)) {
      setMsg("");
      setPendingConflict(res.error);
      return;
    }
    setPendingConflict(null);
    setMsg(res.error);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-medium">Bookings</h1>
      <p className="mt-1 text-muted">Calendar of lessons, student requests, and time swaps.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["upcoming", "requests", "completed", "cancelled"] as const).map((t) => (
          <Link
            key={t}
            to="/app/bookings"
            search={{ tab: t, swap: undefined }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium capitalize ring-1",
              tab === t ? "bg-forest text-on-forest ring-forest" : "ring-line",
            )}
          >
            {t}
            {t === "requests" && inbox?.pending ? ` · ${inbox.pending}` : ""}
          </Link>
        ))}
      </div>

      {tab === "requests" ? (
        <div className="mt-6 space-y-4">
          {(inbox?.requests || []).map((r) => (
            <div key={r.id} className="rounded-2xl bg-card p-4 ring-1 ring-line">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {r.kind === "coach_swap" ? "Swap" : "Move request"} · {r.status}
              </p>
              <p className="type-primary mt-1 break-words font-semibold">{r.studentName}</p>
              <p className="type-primary type-follow break-words text-sm">
                {r.kind === "coach_swap"
                  ? `${r.studentWhen} ⇄ ${r.otherName} · ${r.otherWhen}`
                  : r.status === "accepted" && r.studentWhen === r.nextWhen
                    ? `Moved to ${r.nextWhen}`
                    : `${r.studentWhen} → ${r.nextWhen}`}
              </p>
              {r.note ? <p className="mt-2 break-words text-sm text-ink-soft">{r.note}</p> : null}
              {r.kind === "coach_swap" && r.status === "pending" ? (
                <p className="mt-2 text-xs text-muted">
                  {firstName(r.studentName)} {r.studentDecision} · {r.otherName ? firstName(r.otherName) : "Student"}{" "}
                  {r.otherDecision || "pending"}
                </p>
              ) : null}
              {r.kind === "student_move" && r.status === "pending" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const res = await coachDecideMoveRequest({ data: { requestId: r.id, decision: "accepted" } });
                      setBusy(false);
                      setMsg(res.ok ? res.message : res.error);
                      if (res.ok) notifyLessonsChanged("request");
                      reload();
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const res = await coachDecideMoveRequest({ data: { requestId: r.id, decision: "declined" } });
                      setBusy(false);
                      setMsg(res.ok ? res.message : res.error);
                      if (res.ok) notifyLessonsChanged("request");
                      reload();
                    }}
                  >
                    Decline
                  </Button>
                </div>
              ) : null}
              {r.kind === "coach_swap" && r.status === "pending" ? (
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const res = await coachWithdrawRequest({ data: { requestId: r.id } });
                    setBusy(false);
                    setMsg(res.ok ? res.message : res.error);
                    if (res.ok) notifyLessonsChanged("request");
                    reload();
                  }}
                >
                  Withdraw
                </Button>
              ) : null}
            </div>
          ))}
          {inbox && inbox.requests.length === 0 ? (
            <p className="text-muted">No requests yet. When a student asks to move, it lands here.</p>
          ) : null}

          <div className="rounded-2xl bg-card p-5 ring-1 ring-line">
            <h2 className="font-display text-2xl">Propose a swap</h2>
            <p className="mt-1 text-sm text-muted">
              Both students get an email with your note. Times move only if both accept. Your assistant can send this too.
            </p>
            <label className="mt-4 block text-sm font-medium">First student</label>
            <select className="field mt-1 min-w-0 max-w-full" value={aId} onChange={(e) => setAId(e.target.value)}>
              <option value="">Choose a lesson</option>
              {upcoming.map((l) => (
                <option key={l.id} value={l.id} disabled={l.id === bId || Boolean(l.pendingKind)}>
                  {l.clientName} · {l.when}
                  {l.pendingKind ? " (request pending)" : ""}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium">Second student</label>
            <select className="field mt-1 min-w-0 max-w-full" value={bId} onChange={(e) => setBId(e.target.value)}>
              <option value="">Choose a lesson</option>
              {upcoming.map((l) => (
                <option key={l.id} value={l.id} disabled={l.id === aId || Boolean(l.pendingKind)}>
                  {l.clientName} · {l.when}
                  {l.pendingKind ? " (request pending)" : ""}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium">Note</label>
            <textarea
              className="field mt-1 h-24 py-3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why these two should swap…"
            />
            <Button className="mt-4" size="field" disabled={busy || !aId || !bId} onClick={() => void sendSwap()}>
              Send to both students
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <MonthCalendar
            lessons={calendarLessons}
            selected={day}
            onSelect={setDay}
            timezone={tz}
            weatherByLesson={weatherByLesson}
            onWeatherResolved={(decision) => {
              reload();
              void reloadWeather();
              if (decision === "cancel") notifyLessonsChanged("weather-cancel");
            }}
          />
        </div>
      )}
      {msg ? <p className="mt-4 text-sm text-ink-soft">{msg}</p> : null}

      <AlertDialog
        open={Boolean(pendingConflict)}
        onOpenChange={(open) => {
          if (!open) setPendingConflict(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Can't send this swap</AlertDialogTitle>
            <AlertDialogDescription className="break-words">{pendingConflict}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={buttonVariants({ size: "field" })}
              onClick={() => setPendingConflict(null)}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={swapSentOpen}
        onOpenChange={(open) => {
          if (!open) setSwapSentOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Swap request sent</AlertDialogTitle>
            <AlertDialogDescription>
              Both students were emailed. The request is pending — times move only if both accept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={buttonVariants({ size: "field" })}
              onClick={() => setSwapSentOpen(false)}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
