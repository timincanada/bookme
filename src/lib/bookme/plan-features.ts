import type { PlanId } from "./subscription";

export const CORE_FEATURES = [
  "Public booking page, including multiple locations",
  "Weekly hours and real open slots",
  "Schedule, booking requests, and approvals",
  "Reschedule, next-week booking, swaps, and recurring lessons",
  "Client records and in-app messages",
  "Payment tracking: unpaid or collected in person",
  "Email reminders and weather alerts",
] as const;

export const ASSISTANT_FEATURES = [
  "Live voice and text conversation",
  "Looks up openings and upcoming lessons",
  "Sends emails to students for you",
  "Reschedules lessons and emails the student",
  "Proposes time swaps between two students (both must accept)",
  "Cancels lessons (you confirm first)",
  "Blocks off hours (existing lessons stay)",
  "Sets up recurring lessons from a conversation",
  "Asks you to confirm before sending or changing anything",
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
};

export type PlanFeatureCard = {
  groups: PlanFeatureGroup[];
  upgrade?: string;
  summary: string;
};

const INCLUDED_SUMMARY =
  "Private Assistant included — live voice and text, student emails, reschedules, swaps, and cancellations. You confirm before anything is sent or changed.";

function included(text: string): PlanFeatureLine {
  return { text, tone: "included" };
}

function assistantGroup(tone: PlanFeatureTone): PlanFeatureGroup {
  return {
    title: "Private Assistant",
    lines: ASSISTANT_FEATURES.map((text) => ({ text, tone })),
  };
}

export function planFeatureCard(plan: PlanId): PlanFeatureCard {
  if (plan === "light") {
    return {
      groups: [
        { title: "Included", kicker: true, lines: CORE_FEATURES.map(included) },
        assistantGroup("excluded"),
      ],
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
