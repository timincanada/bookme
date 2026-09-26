import { useEffect, useRef } from "react";

/** In-tab DOM event. Same document, including this tab's own writes. */
export const LESSONS_CHANGED_EVENT = "bookme:lessons-changed";

/** Cross-tab channel. Other documents with this app open. */
export const LESSONS_CHANNEL_NAME = "bookme-lessons";

/** Focus, visibility, and bfcache refetches closer together than this are skipped. */
export const LESSONS_FOCUS_GAP_MS = 1500;

export type LessonsChanged = {
  version: number;
  at: number;
  reason?: string;
};

export type LessonsRefreshKind = "signal" | "focus";

export type UseLessonsRefreshOptions = {
  /** Ignore focus / visibility / bfcache refetches for this long after the last refetch. */
  focusGapMs?: number;
  /**
   * Persistent shell (outside the router outlet): refetch when the path changes.
   * Pages that remount on navigation should omit this.
   */
  pathname?: string;
};

type LessonsListener = (detail: LessonsChanged) => void;

type LessonsWire = LessonsChanged & { tabId: string };

const READ_ONLY_KINDS = new Set(["openings", "schedule", "import_form"]);
const READ_ONLY_ACTIONS = new Set(["list_availability", "list_lessons"]);

let version = 0;
const listeners = new Set<LessonsListener>();
let channel: BroadcastChannel | null = null;
let channelFailed = false;

function newTabId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const TAB_ID = newTabId();

export function getLessonsVersion() {
  return version;
}

/**
 * Focus-style refetches are skipped until `gapMs` has passed.
 * Explicit lesson-changed signals always run.
 */
export function shouldRefreshLessons(
  lastAt: number,
  now: number,
  kind: LessonsRefreshKind,
  gapMs = LESSONS_FOCUS_GAP_MS,
): boolean {
  if (kind === "signal") return true;
  if (!Number.isFinite(lastAt) || lastAt <= 0) return true;
  if (!Number.isFinite(now)) return false;
  return now - lastAt >= gapMs;
}

/**
 * True when an assistant turn finished a write.
 * Read-only lists and confirm previews return false. A bare `{ ok: true, message }`
 * (move, cancel, swap, block, import) returns true. An extra refetch is cheap.
 */
export function assistantTurnMutated(res: {
  ok: boolean;
  needsConfirm?: boolean;
  importForm?: boolean;
  action?: { type?: string } | null;
  preview?: { kind?: string; groups?: readonly unknown[] } | null;
}): boolean {
  if (!res.ok || res.needsConfirm || res.importForm) return false;
  const kind = res.preview?.kind;
  if (kind && READ_ONLY_KINDS.has(kind)) return false;
  if (res.preview?.groups && res.preview.groups.length > 0) return false;
  const type = res.action?.type;
  if (type && READ_ONLY_ACTIONS.has(type)) return false;
  return true;
}

export function subscribeLessonsChanged(listener: LessonsListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dispatchInTab(detail: LessonsChanged) {
  if (typeof window === "undefined" || typeof CustomEvent !== "function") return;
  try {
    window.dispatchEvent(new CustomEvent(LESSONS_CHANGED_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

function openLessonsChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (channelFailed) return null;
  if (typeof window === "undefined") return null;
  const Ctor = globalThis.BroadcastChannel;
  if (typeof Ctor !== "function") {
    channelFailed = true;
    return null;
  }
  try {
    channel = new Ctor(LESSONS_CHANNEL_NAME);
    return channel;
  } catch {
    channelFailed = true;
    return null;
  }
}

function readLessonsWire(data: unknown): LessonsWire | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as { version?: unknown; at?: unknown; reason?: unknown; tabId?: unknown };
  if (typeof rec.version !== "number" || !Number.isFinite(rec.version)) return null;
  if (typeof rec.tabId !== "string" || !rec.tabId) return null;
  const wire: LessonsWire = {
    version: rec.version,
    at: typeof rec.at === "number" && Number.isFinite(rec.at) ? rec.at : Date.now(),
    tabId: rec.tabId,
  };
  if (typeof rec.reason === "string" && rec.reason) wire.reason = rec.reason;
  return wire;
}

function noteRemoteVersion(next: number) {
  if (next > version) version = next;
}

/** Bump the shared version and tell this tab plus any other open tabs. */
export function notifyLessonsChanged(reason?: string): LessonsChanged {
  version += 1;
  const detail: LessonsChanged = { version, at: Date.now() };
  if (reason) detail.reason = reason;
  for (const listener of [...listeners]) {
    try {
      listener(detail);
    } catch {
      /* one listener cannot block the rest */
    }
  }
  dispatchInTab(detail);
  const bus = openLessonsChannel();
  if (bus) {
    try {
      bus.postMessage({ ...detail, tabId: TAB_ID });
    } catch {
      /* ignore */
    }
  }
  return detail;
}

/**
 * Refetch lesson/booking/request data when lessons change, the window regains
 * focus, or (for a persistent shell) the path changes.
 * `reload` is read from a ref so the subscriptions do not follow each render.
 */
export function useLessonsRefresh(reload: () => void, opts?: UseLessonsRefreshOptions) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const gapRef = useRef(LESSONS_FOCUS_GAP_MS);
  gapRef.current = opts?.focusGapMs ?? LESSONS_FOCUS_GAP_MS;
  const lastAtRef = useRef(0);
  const runRef = useRef<(kind: LessonsRefreshKind) => void>(() => {});
  runRef.current = (kind) => {
    const now = Date.now();
    if (!shouldRefreshLessons(lastAtRef.current, now, kind, gapRef.current)) return;
    lastAtRef.current = now;
    reloadRef.current();
  };

  useEffect(() => {
    // Caller fetches on mount. Start the focus gap here so that fetch isn't doubled.
    lastAtRef.current = Date.now();
    const onSignal = () => runRef.current("signal");
    const unsub = subscribeLessonsChanged(onSignal);
    const onFocus = () => runRef.current("focus");
    const onVisible = () => {
      if (document.visibilityState === "visible") runRef.current("focus");
    };
    const onPageShow = (event: Event) => {
      if ((event as PageTransitionEvent).persisted) runRef.current("focus");
    };
    const onMessage = (event: MessageEvent) => {
      const wire = readLessonsWire(event.data);
      if (!wire || wire.tabId === TAB_ID) return;
      noteRemoteVersion(wire.version);
      onSignal();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    const bus = openLessonsChannel();
    bus?.addEventListener("message", onMessage);

    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
      bus?.removeEventListener("message", onMessage);
    };
  }, []);

  const pathname = opts?.pathname;
  const pathRef = useRef<string | null>(null);
  useEffect(() => {
    if (pathname === undefined) return;
    if (pathRef.current === null) {
      pathRef.current = pathname;
      return;
    }
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    runRef.current("signal");
  }, [pathname]);
}
