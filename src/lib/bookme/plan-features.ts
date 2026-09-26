import type { PlanId } from "./subscription";

export const CORE_FEATURES = [
  "Booking page, schedule and requests",
  "Weekly hours and real open slots",
  "Reschedules, swaps and recurring lessons",
  "Client records and messages",
  "Payment tracking and email reminders",
  "Weather alerts",
] as const;

export const ASSISTANT_LEAD = "A dedicated Private Assistant you can name";

export const ASSISTANT_FEATURES = [
  "Live voice and text conversation",
  "Looks up openings and your schedule",
  "Emails students for you",
  "Reschedules and cancels lessons, and emails the student",
  "Proposes time swaps between students (both must accept)",
  "Blocks off hours and sets up recurring lessons",
] as const;

/** Under the included Assistant list. Not a check item. */
export const ASSISTANT_NOTE = "You confirm before anything is sent or changed";

export const ASSISTANT_EXCLUDED = [
  "Voice and text conversation",
  "Emails and reschedules for you",
  "Swaps and cancellations",
] as const;

export const ASSISTANT_UPGRADE = "Upgrade to Coach for your Private Assistant";

export type PlanFeatureTone = "included" | "excluded";

export type PlanFeatureLine = {
  text: string;
  tone: PlanFeatureTone;
};

export type PlanFeatureGroup = {
  title?: string;
  /** Small uppercase label. */
  kicker?: boolean;
  lines: PlanFeatureLine[];
  /** Small muted line under the list. Not a check or cross item. */
  note?: string;
};

export type PlanFeatureCard = {
  groups: PlanFeatureGroup[];
  upgrade?: string;
  summary: string;
};

const INCLUDED_SUMMARY =
  "Private Assistant included — live voice and text, student emails, reschedules and cancellations (the student is emailed), and time swaps both students must accept. You confirm before anything is sent or changed.";

function included(text: string): PlanFeatureLine {
  return { text, tone: "included" };
}

function assistantGroup(tone: PlanFeatureTone): PlanFeatureGroup {
  if (tone === "excluded") {
    return {
      title: "Private Assistant",
      lines: ASSISTANT_EXCLUDED.map((text) => ({ text, tone })),
    };
  }
  return {
    title: ASSISTANT_LEAD,
    lines: ASSISTANT_FEATURES.map((text) => ({ text, tone })),
    note: ASSISTANT_NOTE,
  };
}

export function planFeatureCard(plan: PlanId): PlanFeatureCard {
  if (plan === "light") {
    return {
      groups: [{ lines: CORE_FEATURES.map(included) }, assistantGroup("excluded")],
      upgrade: ASSISTANT_UPGRADE,
      summary: `Private Assistant not included. ${ASSISTANT_UPGRADE}.`,
    };
  }
  if (plan === "busy") {
    return {
      groups: [assistantGroup("included"), { lines: [included("Everything in Coach")] }],
      summary: INCLUDED_SUMMARY,
    };
  }
  return {
    groups: [assistantGroup("included"), { lines: [included("Everything in Light")] }],
    summary: INCLUDED_SUMMARY,
  };
}
