import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle, Repeat } from "lucide-react";
import { useCoach } from "@/lib/bookme/coach-context";
import { listMyLessons } from "@/lib/bookme/api";
import { notifyLessonsChanged, useLessonsRefresh } from "@/lib/bookme/lessons-sync";
import { WeekCalendar, nextLessonDay, type CalLesson } from "@/components/bookme/lesson-calendar";
import { useCoachWeather } from "@/components/bookme/use-lesson-weather";
import { BookingRequestBanner } from "@/components/bookme/ui/booking-request-banner";
import { PageFrame } from "@/components/bookme/ui/page-frame";
import { PageTitle } from "@/components/bookme/ui/page-title";
import { ErrorState, ListSkeleton } from "@/components/bookme/ui/screen-states";
import { useDemoUi } from "@/lib/bookme/demo-ui";
import { hideQaRecords } from "@/lib/bookme/qa-surface";
import { HSCROLL } from "@/lib/bookme/ui-classes";
import { DEFAULT_TIMEZONE } from "@/lib/bookme/timezone";
import { todayKey } from "@/lib/bookme/time";
import { usePurchasePolicy } from "@/lib/native/purchases";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/app/")({ component: Schedule });

function Schedule() {
  const { coach } = useCoach();
  const { byId: weatherByLesson, reload: reloadWeather } = useCoachWeather();
  const [lessons, setLessons] = useState<CalLesson[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const policy = usePurchasePolicy();
  const demo = useDemoUi();
  const tz = coach?.timezone || DEFAULT_TIMEZONE;
  const [day, setDay] = useState(() => todayKey(tz));
  const snapped = useRef(false);

  function reloadLessons() {
    listMyLessons()
      .then((r) => {
        if (!r.ok) {
          setPhase("error");
          return;
        }
        const upcoming = hideQaRecords(
          r.lessons.filter((l) => l.bucket === "upcoming"),
          demo,
        );
        setLessons(upcoming);
        setPhase("ready");
        if (!snapped.current) {
          snapped.current = true;
          setDay(nextLessonDay(upcoming, r.timezone));
        }
      })
      .catch(() => setPhase("error"));
  }

  useLessonsRefresh(reloadLessons);

  useEffect(() => {
    reloadLessons();
    // demo flips after the server answers on preview; reload so QA rows match the gate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  if (!coach) return null;

  const countLabel = `${lessons.length} upcoming lesson${lessons.length === 1 ? "" : "s"}`;

  return (
    <PageFrame wide>
      <PageTitle
        title="Schedule"
        subtitle={countLabel}
        aside={
          <Link
            to="/app/bookings"
            search={{ tab: "upcoming", swap: undefined }}
            className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-pill)] px-3 text-sm font-semibold text-forest ring-1 ring-line"
          >
            Month
            <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        }
      />
      <div className={HSCROLL + " mt-1"}>
        <Link to="/app/messages" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-muted">
          <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden />
          Messages
          {coach.unreadMessages ? (
            <span className="rounded-full bg-forest px-1.5 text-[10px] font-semibold leading-4 text-on-forest">
              {coach.unreadMessages > 9 ? "9+" : coach.unreadMessages}
            </span>
          ) : null}
        </Link>
        <Link
          to="/app/import"
          search={{ client: undefined }}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-muted"
        >
          <Repeat className="size-4" strokeWidth={1.75} aria-hidden />
          Import recurring
        </Link>
      </div>
      {!coach.setup ? (
        <Link
          to="/app/setup"
          className="type-key mt-4 block rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest"
        >
          Finish Open for business to publish your link
        </Link>
      ) : !coach.open && policy.ready ? (
        policy.showPurchases ? (
          <Link
            to="/app/billing"
            className="type-key mt-4 block rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest"
          >
            Start a trial to copy your booking link
          </Link>
        ) : (
          <p className="type-key mt-4 rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest">
            Your booking link isn't active.
          </p>
        )
      ) : null}
      <BookingRequestBanner count={coach.pendingRequests || 0} />
      {phase === "loading" && lessons.length === 0 ? <ListSkeleton rows={3} /> : null}
      {phase === "error" ? <ErrorState onRetry={reloadLessons} /> : null}
      {phase === "ready" || lessons.length > 0 ? (
      <div className="mt-6">
        <WeekCalendar
          lessons={lessons}
          hours={coach.hours}
          selected={day}
          onSelect={setDay}
          timezone={tz}
          weatherByLesson={weatherByLesson}
          onWeatherResolved={(decision) => {
            void reloadWeather();
            if (decision === "cancel") {
              notifyLessonsChanged("weather-cancel");
              reloadLessons();
            }
          }}
        />
      </div>
      ) : null}
    </PageFrame>
  );
}
