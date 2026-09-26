import assert from "node:assert/strict";
import {
  LESSONS_CHANNEL_NAME,
  LESSONS_CHANGED_EVENT,
  LESSONS_FOCUS_GAP_MS,
  assistantTurnMutated,
  getLessonsVersion,
  notifyLessonsChanged,
  shouldRefreshLessons,
  subscribeLessonsChanged,
} from "./lessons-sync.ts";

assert.equal(LESSONS_CHANNEL_NAME, "bookme-lessons");
assert.equal(LESSONS_CHANGED_EVENT, "bookme:lessons-changed");
assert.equal(LESSONS_FOCUS_GAP_MS, 1500);

const before = getLessonsVersion();
const first = notifyLessonsChanged("confirm");
assert.equal(first.version, before + 1);
assert.equal(first.reason, "confirm");
assert.equal(getLessonsVersion(), before + 1);
assert.equal(typeof first.at, "number");

const seen: string[] = [];
const unsubA = subscribeLessonsChanged((detail) => {
  seen.push(`a:${detail.version}:${detail.reason ?? ""}`);
});
const unsubB = subscribeLessonsChanged((detail) => {
  seen.push(`b:${detail.version}`);
});
const second = notifyLessonsChanged("voice-tool");
assert.equal(second.version, before + 2);
assert.deepEqual(seen, [`a:${before + 2}:voice-tool`, `b:${before + 2}`]);

unsubA();
notifyLessonsChanged();
assert.equal(getLessonsVersion(), before + 3);
assert.deepEqual(seen, [`a:${before + 2}:voice-tool`, `b:${before + 2}`, `b:${before + 3}`]);
assert.equal(seen.filter((row) => row.startsWith("a:")).length, 1);

unsubB();
notifyLessonsChanged("after");
assert.equal(getLessonsVersion(), before + 4);
assert.equal(seen.length, 3);

let calls = 0;
const unsubSelf = subscribeLessonsChanged(() => {
  calls += 1;
  unsubSelf();
});
notifyLessonsChanged("once");
notifyLessonsChanged("twice");
assert.equal(calls, 1);
unsubSelf();

let survived = 0;
const unsubBad = subscribeLessonsChanged(() => {
  throw new Error("listener failed");
});
const unsubOk = subscribeLessonsChanged(() => {
  survived += 1;
});
notifyLessonsChanged("boom");
assert.equal(survived, 1);
assert.equal(getLessonsVersion(), before + 7);
unsubBad();
unsubOk();

assert.equal(shouldRefreshLessons(0, 5_000, "focus"), true);
assert.equal(shouldRefreshLessons(-1, 5_000, "focus"), true);
assert.equal(shouldRefreshLessons(Number.NaN, 5_000, "focus"), true);
assert.equal(shouldRefreshLessons(1_000, 2_499, "focus"), false);
assert.equal(shouldRefreshLessons(1_000, 2_500, "focus"), true);
assert.equal(shouldRefreshLessons(1_000, 1_000, "signal"), true);
assert.equal(shouldRefreshLessons(1_000, 1_001, "signal"), true);
assert.equal(shouldRefreshLessons(1_000, Number.NaN, "focus"), false);
assert.equal(shouldRefreshLessons(1_000, 1_400, "focus", 500), false);
assert.equal(shouldRefreshLessons(1_000, 1_500, "focus", 500), true);

let last = 0;
function attempt(kind: "signal" | "focus", now: number) {
  if (!shouldRefreshLessons(last, now, kind)) return false;
  last = now;
  return true;
}
assert.equal(attempt("focus", 10_000), true);
assert.equal(attempt("focus", 11_000), false);
assert.equal(attempt("signal", 11_100), true);
assert.equal(attempt("focus", 11_200), false);
assert.equal(attempt("focus", 12_600), true);

assert.equal(assistantTurnMutated({ ok: false }), false);
assert.equal(
  assistantTurnMutated({ ok: true, needsConfirm: true, action: { type: "cancel_lesson" } }),
  false,
);
assert.equal(assistantTurnMutated({ ok: true, importForm: true }), false);
assert.equal(
  assistantTurnMutated({ ok: true, preview: { kind: "schedule", groups: [{ lines: ["9:00"] }] } }),
  false,
);
assert.equal(assistantTurnMutated({ ok: true, preview: { kind: "openings", groups: [] } }), false);
assert.equal(assistantTurnMutated({ ok: true, preview: { kind: "import_form" } }), false);
assert.equal(assistantTurnMutated({ ok: true, action: { type: "list_lessons" } }), false);
assert.equal(assistantTurnMutated({ ok: true, action: { type: "list_availability" } }), false);
assert.equal(assistantTurnMutated({ ok: true }), true);
assert.equal(assistantTurnMutated({ ok: true, action: { type: "cancel_lesson" } }), true);
assert.equal(assistantTurnMutated({ ok: true, action: { type: "draft_swap" } }), true);
assert.equal(assistantTurnMutated({ ok: true, action: { type: "draft_reschedule" } }), true);
assert.equal(assistantTurnMutated({ ok: true, preview: { kind: "import_done" } }), true);

console.log("lessons-sync tests ok");
