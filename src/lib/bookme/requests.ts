export type RequestKind = "student_move" | "coach_swap";
export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type PartyDecision = "pending" | "accepted" | "declined";

export function firstName(name: string) {
  const part = String(name || "").trim().split(/\s+/)[0];
  return part || "Student";
}

export function clipNote(note: string, max = 400) {
  return String(note || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function swapPlan(
  a: { duration: number; start: Date },
  b: { duration: number; start: Date },
) {
  if (a.duration !== b.duration) {
    return { ok: false as const, error: "Both lessons need the same length to swap." };
  }
  if (a.start.getTime() === b.start.getTime()) {
    return { ok: false as const, error: "Those lessons are already at the same time." };
  }
  return {
    ok: true as const,
    aEnd: new Date(b.start.getTime() + a.duration * 60_000),
    bEnd: new Date(a.start.getTime() + b.duration * 60_000),
  };
}

export function afterPartyDecision(
  student: PartyDecision,
  other: PartyDecision | null | undefined,
): RequestStatus {
  if (student === "declined" || other === "declined") return "declined";
  if (student === "accepted" && other === "accepted") return "accepted";
  return "pending";
}

export function isOpenRequest(status: string) {
  return status === "pending";
}

/** Label a request from the student who opened the manage link. */
/** Students never see each other's names in swap requests. */
export const ANOTHER_STUDENT = "Another student";

export function viewerRequestView(input: {
  viewerEmail: string;
  primaryEmail: string;
  primaryWhen: string;
  primaryLessonId: string;
  otherEmail?: string | null;
  otherWhen?: string | null;
  otherLessonId?: string | null;
  kind: string;
  status: string;
  studentDecision: string;
  otherDecision?: string | null;
  studentToken?: string | null;
  otherToken?: string | null;
}) {
  const isPrimary = input.viewerEmail.trim().toLowerCase() === input.primaryEmail.trim().toLowerCase();
  const yourWhen = isPrimary ? input.primaryWhen : input.otherWhen || input.primaryWhen;
  const otherWhen = input.kind === "coach_swap" ? (isPrimary ? input.otherWhen || null : input.primaryWhen) : null;
  const otherLabel = input.kind === "coach_swap" ? ANOTHER_STUDENT : null;
  const lessonId = isPrimary ? input.primaryLessonId : input.otherLessonId || input.primaryLessonId;
  const decision = (isPrimary ? input.studentDecision : input.otherDecision || "pending") as PartyDecision;
  const token = isPrimary ? input.studentToken || null : input.otherToken || null;
  const canDecide =
    isOpenRequest(input.status) && input.kind === "coach_swap" && decision === "pending" && Boolean(token);
  return { isPrimary, yourWhen, otherWhen, otherLabel, lessonId, decision, token, canDecide };
}
