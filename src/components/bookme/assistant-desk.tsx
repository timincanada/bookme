import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MoreHorizontal,
  Repeat,
  Search,
} from "lucide-react";
import { RecurringPlanCard } from "@/components/bookme/recurring-plan-card";
import { Button } from "@/components/ui/button";
import type { AssistantPreview, UpcomingLesson } from "@/lib/bookme/api";
import { assistantDeskTitle } from "@/lib/bookme/assistant-name";
import { cn } from "@/lib/utils";

export const ASSISTANT_PHOTO = "/photos/assistant.jpg";

export function assistantTitle(coachName: string, assistantName?: string | null) {
  return assistantDeskTitle(coachName, assistantName);
}

export function formatClock(at: number, timeZone: string) {
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function formatLessonStamp(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return { day, time, line: day + "  •  " + time };
}

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "S";
}

export function AssistantAvatar({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <img
      src={ASSISTANT_PHOTO}
      alt=""
      className={cn(
        "shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10",
        size === "sm" ? "size-8" : "size-11",
        className,
      )}
    />
  );
}

export function StudentMark({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-sage-2 font-semibold text-forest",
        size === "md" ? "size-8 text-xs" : "size-6 text-[10px]",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AssistantHeader({
  coachName,
  assistantName,
  status,
  live,
}: {
  coachName: string;
  assistantName?: string | null;
  status: string;
  live: boolean;
}) {
  return (
    <header className="flex items-center gap-1 border-b border-line bg-cream px-2 py-2">
      <Link
        to="/app"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-3 text-ink"
        aria-label="Back"
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} />
      </Link>
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pl-0.5">
        <p className="truncate font-semibold leading-tight text-ink">{assistantTitle(coachName, assistantName)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-success">
          <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-success/70")} />
          {status}
        </p>
      </div>
      <Link
        to="/app/more/assistant"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-3 text-ink"
        aria-label="Assistant settings"
      >
        <MoreHorizontal className="size-5" strokeWidth={1.75} />
      </Link>
    </header>
  );
}

export function UpcomingLessonCard({ lesson, timeZone }: { lesson: UpcomingLesson; timeZone: string }) {
  const stamp = formatLessonStamp(lesson.startAt, timeZone);
  return (
    <Link
      to="/app/lessons/$id"
      params={{ id: lesson.id }}
      className="block rounded-2xl bg-card p-3.5 shadow-soft ring-1 ring-line"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-3 text-forest">
          <CalendarDays className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Upcoming Lesson</p>
          <p className="mt-0.5 text-sm text-muted">{stamp.line}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink">
            <StudentMark name={lesson.clientName} />
            {lesson.clientName}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
            {lesson.location}
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted" strokeWidth={1.75} />
      </div>
    </Link>
  );
}

export function ChatBubble({
  role,
  text,
  at,
  timeZone,
}: {
  role: "user" | "assistant";
  text: string;
  at: number;
  timeZone: string;
}) {
  if (role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-forest px-3.5 py-2.5 text-sm leading-relaxed text-on-forest">
          {text}
        </div>
        <p className="flex items-center gap-0.5 pr-1 text-[11px] text-muted">
          {formatClock(at, timeZone)}
          <CheckCheck className="size-3.5 text-forest" strokeWidth={2} />
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <AssistantAvatar size="sm" />
      <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-soft ring-1 ring-line">
        <span className="whitespace-pre-line">{text}</span>
      </div>
    </div>
  );
}

export function ThinkingRow() {
  return (
    <div className="flex items-end gap-2">
      <AssistantAvatar size="sm" />
      <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-soft ring-1 ring-line">
        <span className="assistant-dots" aria-label="One moment">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

export function ResultCard({
  preview,
  onOpenings,
}: {
  preview: AssistantPreview;
  onOpenings?: () => void;
}) {
  if (preview.kind === "cancel" && !preview.confirmLabel) {
    return <CancelledCard preview={preview} />;
  }
  if ((preview.kind === "import_form" || preview.kind === "import_done") && preview.href) {
    return <LinkCard preview={preview} />;
  }
  if (preview.kind === "import") return null;
  if (preview.kind === "schedule" && preview.groups?.length) {
    return <ScheduleCard preview={preview} />;
  }
  if (preview.kind === "openings" && preview.groups?.length) {
    return <OpeningsCard preview={preview} />;
  }
  if (preview.kind === "cancel") return null;
  if (!preview.groups?.length) return null;
  return (
    <button type="button" onClick={onOpenings} className="w-full rounded-2xl bg-sage-3 px-4 py-3 text-left text-sm text-ink">
      {preview.groups.map((g) => (
        <p key={g.dateKey}>
          <span className="font-semibold">{g.label}</span>
          {g.lines.length ? " · " + g.lines.slice(0, 4).join(", ") : " · none"}
        </p>
      ))}
    </button>
  );
}

function LinkCard({ preview }: { preview: AssistantPreview }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-line">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid size-9 place-items-center rounded-full bg-sage-3 text-forest">
          {preview.kind === "import_done" ? <Check className="size-4" strokeWidth={2.4} /> : <Repeat className="size-4" strokeWidth={2} />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">{preview.heading}</p>
          {preview.fields?.map((f) => (
            <p key={f.label} className="text-sm text-muted">
              {f.value}
            </p>
          ))}
        </div>
      </div>
      <a
        href={preview.href}
        className="mt-3 flex items-center justify-between bg-sage-3 px-4 py-3 text-sm font-semibold text-forest"
      >
        {preview.kind === "import_done" ? "Open schedule" : "Open import form"}
        <ChevronRight className="size-4" strokeWidth={1.75} />
      </a>
    </div>
  );
}

function CancelledCard({ preview }: { preview: AssistantPreview }) {
  const when = preview.fields?.find((f) => f.label === "When")?.value || "";
  const who = preview.fields?.find((f) => f.label === "Student")?.value || "";
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-line">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid size-9 place-items-center rounded-full bg-success text-on-forest">
          <Check className="size-4" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">Lesson Cancelled</p>
          <p className="mt-0.5 text-sm text-muted">{when}</p>
          <p className="text-sm text-muted">{who}</p>
        </div>
      </div>
      <Link
        to="/app"
        className="mt-3 flex items-center justify-between bg-sage-3 px-4 py-3 text-sm font-semibold text-forest"
      >
        View updated schedule
        <ChevronRight className="size-4" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function ScheduleCard({ preview }: { preview: AssistantPreview }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">{preview.heading || "Upcoming lessons"}</p>
      <ul className="mt-2 space-y-2">
        {preview.groups!.map((g) => (
          <li key={g.dateKey} className="text-sm">
            <p className="font-medium text-forest">{g.label}</p>
            {g.lines.map((line) => (
              <p key={line} className="text-muted">
                {line}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpeningsCard({ preview }: { preview: AssistantPreview }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">Open times</p>
      <ul className="mt-2 space-y-2">
        {preview.groups!.map((g) => (
          <li key={g.dateKey} className="text-sm">
            <p className="font-medium text-forest">{g.label}</p>
            <p className="text-muted">{g.lines.length ? g.lines.slice(0, 6).join(" · ") : "None"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConfirmCard({
  preview,
  onConfirm,
  onSkip,
}: {
  preview: AssistantPreview;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  if (preview.kind === "import" && preview.importPlan) {
    return (
      <RecurringPlanCard
        plan={preview.importPlan}
        onConfirm={onConfirm}
        onCancel={onSkip}
        confirmLabel={preview.confirmLabel}
        cancelLabel={preview.cancelLabel || "Don't import"}
      />
    );
  }
  if (preview.kind === "cancel") {
    const when = preview.fields?.find((f) => f.label === "When")?.value || "";
    const who = preview.fields?.find((f) => f.label === "Student")?.value || "";
    return (
      <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-line">
        <div className="px-4 pt-4">
          <p className="font-semibold text-ink">Cancel this lesson?</p>
          <p className="mt-1 text-sm text-muted">{when}</p>
          <p className="text-sm text-muted">{who}</p>
          {preview.note ? <p className="mt-2 text-sm text-ink-soft">{preview.note}</p> : null}
        </div>
        <div className="mt-3 space-y-1 px-4 pb-3">
          <Button className="w-full" size="field" onClick={onConfirm}>
            {preview.confirmLabel || "Cancel lesson"}
          </Button>
          <button type="button" className="w-full py-2 text-sm font-semibold text-forest" onClick={onSkip}>
            {preview.cancelLabel || "Keep lesson"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-line">
      {preview.heading ? <p className="font-semibold text-forest">{preview.heading}</p> : null}
      {preview.fields?.map((f, i) => (
        <div key={i} className="mt-2">
          {f.label ? <p className="text-xs text-muted">{f.label}</p> : null}
          <p className="whitespace-pre-wrap text-sm">{f.value}</p>
        </div>
      ))}
      {preview.note ? <p className="mt-2 text-sm">{preview.note}</p> : null}
      {preview.footer ? <p className="mt-1 text-xs text-muted">{preview.footer}</p> : null}
      <Button className="mt-3" size="field" onClick={onConfirm}>
        {preview.confirmLabel || "Confirm"}
      </Button>
      <button type="button" className="mt-2 w-full py-2 text-sm font-semibold text-forest" onClick={onSkip}>
        {preview.cancelLabel || "Skip"}
      </button>
    </div>
  );
}

export function QuickChips({
  onReschedule,
  onOpenings,
  onSchedule,
}: {
  onReschedule: () => void;
  onOpenings: () => void;
  onSchedule: () => void;
}) {
  const chips = [
    { label: "Reschedule", icon: CalendarDays, onClick: onReschedule },
    { label: "Find a new time", icon: Search, onClick: onOpenings },
    { label: "View schedule", icon: CalendarDays, onClick: onSchedule },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-medium text-forest shadow-soft ring-1 ring-line"
        >
          <c.icon className="size-4" strokeWidth={1.75} />
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  onMic,
  talkLabel,
  live,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onMic: () => void;
  talkLabel: string;
  live: boolean;
  disabled: boolean;
}) {
  return (
    <form
      className="flex items-center gap-2 border-t border-line bg-cream px-3 pb-2 pt-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <input
        id="assistant-input"
        className="h-11 min-w-0 flex-1 rounded-full border-0 bg-card px-4 text-sm text-ink shadow-soft ring-1 ring-line outline-none placeholder:text-muted"
        placeholder="Message your assistant…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        disabled={disabled}
      />
      <button
        type="button"
        className={cn(
          "assistant-talk grid size-11 shrink-0 place-items-center rounded-full bg-forest text-on-forest shadow-card transition-transform duration-150 ease-out active:scale-[0.96]",
          live && "is-live",
          disabled && "opacity-60",
        )}
        aria-label={talkLabel}
        disabled={disabled}
        onClick={onMic}
      >
        <MicIcon />
      </button>
    </form>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path
        d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7.5 11.5a4.5 4.5 0 0 0 9 0M12 16v3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

