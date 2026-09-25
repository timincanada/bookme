import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AssistantAvatar } from "@/components/bookme/assistant-desk";
import { cn } from "@/lib/utils";

export type VoicePanelState = "connecting" | "listening" | "thinking" | "speaking";

const STATUS: Record<VoicePanelState, string> = {
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function VoiceModePanel({
  state,
  userCaption,
  assistantCaption,
  onEnd,
  getLevels,
}: {
  state: VoicePanelState;
  userCaption: string;
  assistantCaption: string;
  onEnd: () => void;
  getLevels: () => { input: number; output: number };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const onEndRef = useRef(onEnd);
  const levelsRef = useRef(getLevels);
  onEndRef.current = onEnd;
  levelsRef.current = getLevels;

  useLayoutEffect(() => {
    endRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onEndRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const current = el.dataset.state;
      const levels = levelsRef.current();
      const level = current === "speaking" ? levels.output : current === "listening" ? levels.input : 0;
      el.style.setProperty("--voice-level", level.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [userCaption, assistantCaption]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-stretch justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-cream md:bg-ink/45" aria-hidden />
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Live voice"
        data-testid="voice-mode-panel"
        data-state={state}
        className="voice-mode-panel relative flex h-full w-full min-h-0 flex-col bg-cream pt-[max(2rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] md:h-auto md:max-h-[min(720px,calc(100dvh-3rem))] md:min-h-[560px] md:w-[480px] md:rounded-[28px] md:px-8 md:pt-10 md:pb-8 md:shadow-card md:ring-1 md:ring-line"
      >
        <div className="flex flex-col items-center pt-4 md:pt-2">
          <div className="relative grid size-44 place-items-center md:size-56">
            <span className="absolute inset-3 rounded-full bg-sage-3" aria-hidden />
            <span className="voice-ring voice-ring-outer" aria-hidden />
            <span className="voice-ring voice-ring-inner" aria-hidden />
            <AssistantAvatar className="relative size-32 shadow-card md:size-40" />
          </div>
          <p data-testid="voice-mode-status" role="status" className="mt-6 text-lg font-semibold text-forest">
            {STATUS[state]}
          </p>
          <div className="mt-3 flex h-4 items-center justify-center">
            {state === "thinking" ? (
              <span className="assistant-dots voice-think-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            ) : null}
          </div>
        </div>

        <div
          ref={captionRef}
          className="mt-4 flex min-h-0 w-full flex-1 flex-col justify-end gap-3 overflow-y-auto overscroll-contain pb-2 md:min-h-36"
        >
          <p
            data-testid="voice-mode-caption-user"
            className={cn(
              "text-center text-lg leading-relaxed break-words whitespace-pre-wrap text-muted",
              !userCaption && "hidden",
            )}
          >
            {userCaption}
          </p>
          <p
            data-testid="voice-mode-caption-assistant"
            className={cn(
              "text-center font-display text-[1.65rem] leading-snug break-words whitespace-pre-wrap text-forest md:text-3xl",
              !assistantCaption && "hidden",
            )}
          >
            {assistantCaption}
          </p>
        </div>

        <button
          ref={endRef}
          type="button"
          data-testid="voice-mode-end"
          className="mx-auto mt-4 flex h-14 min-h-14 w-full max-w-sm shrink-0 items-center justify-center rounded-full bg-coral text-base font-semibold text-on-forest shadow-soft hover:bg-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 active:scale-[0.98]"
          onClick={onEnd}
        >
          End
        </button>
      </div>
    </div>,
    document.body,
  );
}
