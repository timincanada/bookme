import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { LessonScan, lessonInstantParts } from "@/components/bookme/lesson-scan";
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
        size === "md" ? "size-8 text-xs" : "size-6 text-[10px] max-md:size-7",
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Matches the mobile type-scale breakpoint (`md` is 768px). */
const MOBILE_TITLE_MQ = "(max-width: 767.98px)";

/**
 * Mobile title steps. Step 0 is `.type-page-dense` (20px / 1.25, 2 lines).
 * 19px stays on 2 lines. 17px may use 3. 14px is only when 17px/3 still
 * clips (a 24-character nickname at 320px). The last clamp is a safety net.
 */
const TITLE_FIT_STEPS = [
  { fontSize: "20px", clamp: "2" },
  { fontSize: "19px", clamp: "2" },
  { fontSize: "17px", clamp: "3" },
  { fontSize: "14px", clamp: "3" },
] as const;

function titleClipped(el: HTMLElement) {
  return el.scrollHeight - el.clientHeight > 1;
}

/** Try each step in order. Inline styles override `.type-page` for the read, then come off. */
function pickTitleStep(el: HTMLElement) {
  const props = [
    "font-size",
    "line-height",
    "display",
    "overflow",
    "white-space",
    "-webkit-box-orient",
    "-webkit-line-clamp",
    "line-clamp",
  ];
  const previous = props.map(
    (prop) => [prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)] as const,
  );
  let chosen = TITLE_FIT_STEPS.length - 1;
  try {
    for (let i = 0; i < TITLE_FIT_STEPS.length; i++) {
      const spec = TITLE_FIT_STEPS[i];
      el.style.setProperty("font-size", spec.fontSize, "important");
      el.style.setProperty("line-height", "1.25", "important");
      el.style.setProperty("display", "-webkit-box", "important");
      el.style.setProperty("-webkit-box-orient", "vertical", "important");
      el.style.setProperty("overflow", "hidden", "important");
      el.style.setProperty("white-space", "normal", "important");
      el.style.setProperty("-webkit-line-clamp", spec.clamp, "important");
      el.style.setProperty("line-clamp", spec.clamp, "important");
      if (!titleClipped(el)) {
        chosen = i;
        break;
      }
    }
  } finally {
    for (const [prop, value, priority] of previous) {
      if (value) el.style.setProperty(prop, value, priority);
      else el.style.removeProperty(prop);
    }
  }
  return chosen;
}

function useMobileTitleStep(title: string) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [step, setStep] = useState(0);
  const [epoch, setEpoch] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    let width = node.clientWidth;
    const bump = () => setEpoch((n) => n + 1);
    const ro = new ResizeObserver(() => {
      const next = node.clientWidth;
      if (next === width) return;
      width = next;
      bump();
    });
    ro.observe(node);

    const mq = window.matchMedia(MOBILE_TITLE_MQ);
    mq.addEventListener("change", bump);

    let cancelled = false;
    const onFonts = () => {
      if (!cancelled) bump();
    };
    if (document.fonts?.status !== "loaded") {
      void document.fonts?.ready.then(onFonts);
      document.fonts?.addEventListener?.("loadingdone", onFonts);
    }

    return () => {
      cancelled = true;
      ro.disconnect();
      mq.removeEventListener("change", bump);
      document.fonts?.removeEventListener?.("loadingdone", onFonts);
    };
  }, [title]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const mobile = window.matchMedia(MOBILE_TITLE_MQ).matches;
    if (!mobile || node.clientWidth === 0) {
      setStep((current) => (current === 0 ? current : 0));
      return;
    }
    const chosen = pickTitleStep(node);
    setStep((current) => (current === chosen ? current : chosen));
  }, [title, epoch]);

  return { ref, step };
}

export function AssistantHeader({
  coachName,
  assistantName,
  status,
  live,
  onNewChat,
}: {
  coachName: string;
  assistantName?: string | null;
  status: string;
  live: boolean;
  onNewChat?: () => void;
}) {
  const title = assistantTitle(coachName, assistantName);
  const { ref: titleRef, step } = useMobileTitleStep(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
        <p
          ref={titleRef}
          data-title-step={step}
          className={cn(
            "type-page type-page-dense max-md:break-words max-md:![overflow-wrap:anywhere] font-semibold leading-tight text-ink md:truncate",
            step > 1 ? "max-md:line-clamp-3" : "max-md:line-clamp-2",
          )}
        >
          {title}
        </p>
        <p className="type-meta mt-0.5 max-md:mt-1 flex items-center gap-1.5 text-xs text-success">
          <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-success/70")} />
          {status}
        </p>
      </div>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Assistant menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-3 text-ink"
        >
          <MoreHorizontal className="size-5" strokeWidth={1.75} />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-2xl bg-card text-ink shadow-card ring-1 ring-line"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-3 text-left text-sm hover:bg-paper-2"
              onClick={() => {
                setMenuOpen(false);
                onNewChat?.();
              }}
            >
              New chat
            </button>
            <Link
              to="/app/more/assistant"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm hover:bg-paper-2"
            >
              Assistant settings
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function UpcomingLessonCard({ lesson, timeZone }: { lesson: UpcomingLesson; timeZone: string }) {
  const stamp = formatLessonStamp(lesson.startAt, timeZone);
  const parts = lessonInstantParts(lesson.startAt, timeZone);
  return (
    <Link
      to="/app/lessons/$id"
      params={{ id: lesson.id }}
      className="block rounded-2xl bg-card p-3.5 shadow-soft ring-1 ring-line"
    >
      <div className="type-card-gap flex items-start gap-3 max-md:hidden">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-3 text-forest">
          <CalendarDays className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-section text-sm font-semibold text-ink">Upcoming Lesson</p>
          <p className="type-primary mt-0.5 text-sm text-muted">{stamp.line}</p>
          <p className="type-primary mt-2 flex items-center gap-2 text-sm text-ink">
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
      <div className="flex items-start gap-2 md:hidden">
        <LessonScan
          className="min-w-0 flex-1"
          label="Upcoming Lesson"
          time={parts.time}
          name={lesson.clientName}
          date={parts.date}
          location={lesson.location}
        />
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
        <div className="type-bubble type-primary max-w-[82%] rounded-2xl rounded-br-md bg-forest px-3.5 py-2.5 text-sm leading-relaxed text-on-forest">
          {text}
        </div>
        <p className="type-meta flex items-center gap-0.5 pr-1 text-[11px] text-muted">
          {formatClock(at, timeZone)}
          <CheckCheck className="size-3.5 text-forest" strokeWidth={2} />
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <AssistantAvatar size="sm" />
      <div className="type-bubble type-primary max-w-[78%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-soft ring-1 ring-line">
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
    <button type="button" onClick={onOpenings} className="type-primary w-full rounded-2xl bg-sage-3 px-4 py-3 text-left text-sm text-ink">
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
          <p className="type-section font-semibold text-ink">{preview.heading}</p>
          {preview.fields?.map((f) => (
            <p key={f.label} className="type-secondary text-sm text-muted">
              {f.value}
            </p>
          ))}
        </div>
      </div>
      <a
        href={preview.href}
        className="type-action mt-3 flex items-center justify-between bg-sage-3 px-4 py-3 text-sm font-semibold text-forest"
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
          <p className="type-section font-semibold text-ink">Lesson Cancelled</p>
          <p className="type-secondary mt-0.5 max-md:mt-1 text-sm text-muted">{when}</p>
          <p className="type-key text-sm text-muted max-md:text-ink">{who}</p>
        </div>
      </div>
      <Link
        to="/app"
        className="type-action mt-3 flex items-center justify-between bg-sage-3 px-4 py-3 text-sm font-semibold text-forest"
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
      <p className="type-section text-sm font-semibold text-ink">{preview.heading || "Upcoming lessons"}</p>
      <ul className="mt-2 space-y-2 max-md:mt-3 max-md:space-y-3">
        {preview.groups!.map((g) => (
          <li key={g.dateKey} className="type-primary text-sm">
            <div className="contents max-md:hidden">
              <p className="font-medium text-forest">{g.label}</p>
              {g.lines.map((line) => (
                <p key={line} className="text-muted">
                  {line}
                </p>
              ))}
            </div>
            <div className="md:hidden">
              {(g.items && g.items.length > 0
                ? g.items
                : g.lines.map((line) => ({ time: line, name: "", location: "" }))
              ).map((item, index) => (
                <div key={`${g.dateKey}-${index}`} className={index > 0 ? "mt-3" : "mt-2"}>
                  <p className="type-label text-muted">Upcoming lesson</p>
                  <p className="type-clock mt-1">{item.time}</p>
                  {item.name ? <p className="type-key mt-1 break-words">{item.name}</p> : null}
                  <p className="type-secondary mt-1 text-muted">{g.label}</p>
                  {item.location ? <p className="type-secondary mt-0.5 break-words text-muted">{item.location}</p> : null}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpeningsCard({ preview }: { preview: AssistantPreview }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-line">
      <p className="type-section text-sm font-semibold text-ink">Open times</p>
      <ul className="mt-2 space-y-2">
        {preview.groups!.map((g) => (
          <li key={g.dateKey} className="type-primary text-sm">
            <div className="contents max-md:hidden">
              <p className="font-medium text-forest">{g.label}</p>
              <p className="text-muted">{g.lines.length ? g.lines.slice(0, 6).join(" · ") : "None"}</p>
            </div>
            <div className="md:hidden">
              <p className="type-secondary font-medium text-forest">{g.label}</p>
              <p className="type-key mt-1">{g.lines.length ? g.lines.slice(0, 6).join(" · ") : "None"}</p>
            </div>
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
          <p className="type-section font-semibold text-ink">Cancel this lesson?</p>
          <p className="type-secondary mt-1 text-sm text-muted">{when}</p>
          <p className="type-key text-sm text-muted max-md:text-ink">{who}</p>
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
      {preview.heading ? <p className="type-section font-semibold text-forest">{preview.heading}</p> : null}
      {preview.fields?.map((f, i) => (
        <div key={i} className="mt-2">
          {f.label ? <p className="type-label text-xs text-muted">{f.label}</p> : null}
          <p className="type-key whitespace-pre-wrap text-sm">{f.value}</p>
        </div>
      ))}
      {preview.note ? <p className="mt-2 text-sm">{preview.note}</p> : null}
      {preview.footer ? <p className="type-meta mt-1 text-xs text-muted">{preview.footer}</p> : null}
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
          className="type-action flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-medium text-forest shadow-soft ring-1 ring-line max-md:min-h-11 max-md:px-4"
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
        className="type-input h-11 min-w-0 flex-1 rounded-full border-0 bg-card px-4 text-sm text-ink shadow-soft ring-1 ring-line outline-none placeholder:text-muted"
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

