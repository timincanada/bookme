import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Repeat } from "lucide-react";
import { useCoach } from "@/lib/bookme/coach-context";
import { listMyLessons } from "@/lib/bookme/api";
import { WeekCalendar, nextLessonDay, type CalLesson } from "@/components/bookme/lesson-calendar";
import { useCoachWeather } from "@/components/bookme/use-lesson-weather";
import { DEFAULT_TIMEZONE } from "@/lib/bookme/timezone";
import { todayKey } from "@/lib/bookme/time";
import { usePurchasePolicy } from "@/lib/native/purchases";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/")({ component: Schedule });

function Schedule() {
  const { coach } = useCoach();
  const { byId: weatherByLesson, reload: reloadWeather } = useCoachWeather();
  const [lessons, setLessons] = useState<CalLesson[]>([]);
  const policy = usePurchasePolicy();
  const tz = coach?.timezone || DEFAULT_TIMEZONE;
  const [day, setDay] = useState(() => todayKey(tz));

  function reloadLessons() {
    listMyLessons().then((r) => {
      if (!r.ok) return;
      const upcoming = r.lessons.filter((l) => l.bucket === "upcoming");
      setLessons(upcoming);
      setDay(nextLessonDay(upcoming, r.timezone));
    });
  }

  useEffect(() => {
    reloadLessons();
  }, []);

  if (!coach) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Schedule</h1>
          <p className="mt-1 text-muted">
            {lessons.length} upcoming lesson{lessons.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/app/messages"
            className="relative inline-flex items-center text-forest"
            aria-label="Messages"
          >
            <MessageCircle className="size-5" strokeWidth={1.75} />
            {coach.unreadMessages ? (
              <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-forest px-1 text-center text-[10px] font-semibold leading-4 text-on-forest">
                {coach.unreadMessages > 9 ? "9+" : coach.unreadMessages}
              </span>
            ) : null}
          </Link>
          <Link
            to="/app/import"
            search={{ client: undefined }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest"
          >
            <Repeat className="size-4" strokeWidth={1.75} />
            Import recurring
          </Link>
          <Link
            to="/app/bookings"
            search={{ tab: "upcoming", swap: undefined }}
            className="text-sm font-semibold text-forest"
          >
            Month
          </Link>
        </div>
      </div>
      {!coach.setup ? (
        <Link
          to="/app/setup"
          className="mt-4 block rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest"
        >
          Finish Open for business to publish your link
        </Link>
      ) : !coach.open && policy.ready ? (
        policy.showPurchases ? (
          <Link
            to="/app/billing"
            className="mt-4 block rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest"
          >
            Start a trial to copy your booking link
          </Link>
        ) : (
          <p className="mt-4 rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest">
            Your booking link isn't active.
          </p>
        )
      ) : null}
      {coach.pendingRequests ? (
        <Link
          to="/app/bookings"
          search={{ tab: "requests", swap: undefined }}
          className="mt-4 block rounded-2xl bg-sage-3 p-3 text-sm font-semibold text-forest"
        >
          {coach.pendingRequests} request{coach.pendingRequests === 1 ? "" : "s"} waiting
        </Link>
      ) : null}
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
            if (decision === "cancel") reloadLessons();
          }}
        />
      </div>
    </div>
  );
}
