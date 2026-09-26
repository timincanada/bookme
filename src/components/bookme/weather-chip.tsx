import { useEffect, useState } from "react";
import { CloudLightning, CloudRain, CloudSun, Snowflake, Wind, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { coachResolveWeather, publicVenueWeather, studentOpenWeatherAsk } from "@/lib/bookme/weather-api";
import type { LessonWeatherView, WeatherSnippet } from "@/lib/bookme/weather-service";
import type { WeatherIconName } from "@/lib/bookme/weather";
import { cn } from "@/lib/utils";

const ICONS = {
  "cloud-sun": CloudSun,
  rain: CloudRain,
  thunder: CloudLightning,
  wind: Wind,
  snow: Snowflake,
} as const;

export function WeatherChipView({
  summary,
  icon,
  extreme,
  size = "md",
}: {
  summary: string;
  icon: WeatherIconName;
  extreme: boolean;
  size?: "md" | "sm";
}) {
  const Icon = ICONS[icon] || CloudSun;
  const small = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2.5 font-medium leading-none",
        small ? "min-h-7 text-xs" : "min-h-8 text-sm",
        extreme ? "border-amber-500 bg-amber-50 text-ink" : "border-line bg-card text-ink",
      )}
    >
      <Icon className={small ? "size-3.5 text-ink-soft" : "size-4 text-ink-soft"} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 break-words">{summary}</span>
      {extreme ? (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          Weather alert
        </span>
      ) : null}
    </span>
  );
}

function extremeLine(view: { headline?: string | null; signal: string | null; extreme: boolean }) {
  if (!view.extreme) return null;
  const headline = view.headline || "Forecast may affect an outdoor lesson";
  return view.signal ? `${headline} · ${view.signal}` : headline;
}

export function WeatherChip({
  view,
  audience,
  onResolved,
  size = "md",
  className,
}: {
  view?: LessonWeatherView | WeatherSnippet | null;
  audience: "coach" | "student" | "public";
  onResolved?: (decision: "keep" | "cancel" | "ask") => void;
  size?: "md" | "sm";
  className?: string;
}) {
  const [dialog, setDialog] = useState<"coach" | "student" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!view || !("summary" in view) || !view.summary) return null;
  const ask = "ask" in view ? view.ask : null;
  const place = "place" in view ? view.place : "";
  const when = "when" in view ? view.when : "";
  const lessonId = "lessonId" in view ? view.lessonId : "";
  const line = extremeLine(view);
  const open = ask?.status === "open";
  const keeping = ask?.status === "keep";
  const canCoach = audience === "coach" && !!lessonId && !keeping && (view.extreme || open);
  const canStudent = audience === "student" && !!lessonId && view.extreme && !open && !keeping;

  async function keep() {
    if (!lessonId) return;
    setBusy(true);
    setError("");
    const res = await coachResolveWeather({ data: { lessonId, decision: "keep" } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDialog(null);
    onResolved?.("keep");
  }

  async function cancel() {
    if (!lessonId) return;
    setBusy(true);
    setError("");
    const res = await coachResolveWeather({ data: { lessonId, decision: "cancel" } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDialog(null);
    onResolved?.("cancel");
  }

  async function askCoach() {
    if (!lessonId) return;
    setBusy(true);
    setError("");
    const res = await studentOpenWeatherAsk({ data: { lessonId } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDialog(null);
    onResolved?.("ask");
  }

  const summaryLine = [place, when, view.signal].filter(Boolean).join(" · ");

  return (
    <div className={cn("flex max-w-full flex-wrap items-center gap-2", className)}>
      <WeatherChipView summary={view.summary} icon={view.icon} extreme={view.extreme} size={size} />
      {canCoach ? (
        open ? (
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-full bg-paper-2 px-2.5 text-sm text-muted"
            onClick={() => {
              setError("");
              setConfirmCancel(false);
              setDialog("coach");
            }}
          >
            Awaiting coach
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-full border border-forest px-2.5 text-sm font-semibold text-forest hover:bg-sage-3"
            onClick={() => {
              setError("");
              setConfirmCancel(false);
              setDialog("coach");
            }}
          >
            Cancel or keep?
          </button>
        )
      ) : null}
      {audience === "student" && open ? (
        <span className="inline-flex h-8 items-center rounded-full bg-paper-2 px-2.5 text-sm text-muted">Awaiting coach</span>
      ) : null}
      {canStudent ? (
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-full border border-forest px-2.5 text-sm font-semibold text-forest hover:bg-sage-3"
          onClick={() => {
            setError("");
            setDialog("student");
          }}
        >
          Ask coach to decide
        </button>
      ) : null}
      {line ? <p className="basis-full text-xs text-ink-soft">{line}</p> : null}
      {audience === "student" && open ? <p className="basis-full text-xs text-muted">Waiting on coach</p> : null}
      {keeping ? (
        <p className="basis-full inline-flex items-center gap-1 text-sm font-semibold text-forest">
          <Check className="size-3.5" strokeWidth={2} aria-hidden />
          Keeping lesson
        </p>
      ) : null}

      <AlertDialog
        open={dialog === "coach"}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setDialog(null);
            setConfirmCancel(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weather decision</AlertDialogTitle>
            <AlertDialogDescription>
              {summaryLine || "Forecast may affect an outdoor lesson."}
              {confirmCancel ? " This cancels the lesson the same way you usually cancel, including the refund." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="mt-2 text-sm text-coral">{error}</p> : null}
          <AlertDialogFooter className="flex-col sm:flex-col">
            {confirmCancel ? (
              <>
                <Button variant="outline" className="w-full text-coral" disabled={busy} onClick={() => void cancel()}>
                  Cancel lesson
                </Button>
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => setConfirmCancel(false)}>
                  Back
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full" disabled={busy} onClick={() => void keep()}>
                  Keep lesson
                </Button>
                <Button variant="outline" className="w-full text-coral" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Cancel lesson
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={dialog === "student"}
        onOpenChange={(next) => {
          if (!next && !busy) setDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ask coach to decide</AlertDialogTitle>
            <AlertDialogDescription>
              {summaryLine ? `${summaryLine}. ` : ""}
              Your coach gets an email and decides whether to keep or cancel. This does not cancel the lesson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <AlertDialogFooter className="flex-col sm:flex-col">
            <Button className="w-full" disabled={busy} onClick={() => void askCoach()}>
              Ask coach to decide
            </Button>
            <AlertDialogCancel asChild>
              <Button variant="outline" className="w-full" disabled={busy}>
                Not now
              </Button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function PublicVenueWeather({
  slug,
  locationId,
  start,
  durationMin,
}: {
  slug: string;
  locationId?: string;
  start: string;
  durationMin?: number;
}) {
  const [view, setView] = useState<LessonWeatherView | null>(null);
  useEffect(() => {
    let alive = true;
    publicVenueWeather({ data: { slug, locationId, start, durationMin } })
      .then((res) => {
        if (!alive) return;
        setView(res.ok ? res.weather : null);
      })
      .catch(() => {
        if (alive) setView(null);
      });
    return () => {
      alive = false;
    };
  }, [slug, locationId, start, durationMin]);
  if (!view) return null;
  return <WeatherChip view={view} audience="public" />;
}
