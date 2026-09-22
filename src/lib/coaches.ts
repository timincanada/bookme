import { VERTICAL_GROUPS, VERTICAL_ITEMS, type VerticalGroupId, type VerticalId, verticalLabel } from "./bookme/verticals";
import { addDays, isoDate, parseISODate } from "./utils";

export type Sport = VerticalId;

export type Lesson = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  blurb: string;
};

export type Location = {
  id: string;
  name: string;
  city: string;
  region: string;
  kind: "in-person" | "online";
};

export type Coach = {
  slug: string;
  name: string;
  sport: Sport;
  headline: string;
  city: string;
  region: string;
  photo: string;
  languages: string[];
  lessons: Lesson[];
  locations: Location[];
  notes: string[];
  bio: string;
  custom?: boolean;
};

export type FindFilter = "all" | VerticalGroupId;

export const SPORTS: { id: FindFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...VERTICAL_GROUPS.map((g) => ({ id: g.id, label: g.label })),
];

export const SPORT_LABEL: Record<string, string> = Object.fromEntries(
  VERTICAL_ITEMS.map((item) => [item.id, item.label]),
);

export function labelForSport(id: string) {
  return SPORT_LABEL[id] ?? verticalLabel(id);
}

export const HST = 0.13;

export function labelForDate(iso: string) {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const d = parseISODate(iso);
  const sub = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  if (iso === today) return { kicker: "Today", sub };
  if (iso === tomorrow) return { kicker: "Tomorrow", sub };
  return { kicker: d.toLocaleDateString("en-CA", { weekday: "short" }), sub };
}

export function findCoach(slug: string, extra: Coach[] = []) {
  return extra.find((c) => c.slug === slug) ?? SEED_COACHES.find((c) => c.slug === slug);
}

export const SEED_COACHES: Coach[] = [
  {
    slug: "daniel-kim",
    name: "Daniel Kim",
    sport: "tennis",
    headline: "Private tennis for every level — technique, match play, and confidence.",
    city: "Markham",
    region: "ON",
    photo: "/photos/daniel-kim.jpg",
    languages: ["English"],
    bio: "Former varsity player coaching juniors and adults on the Mayfair courts.",
    notes: ["Bring your racquet and water.", "Free cancellation up to 24 hours before your lesson."],
    lessons: [{ id: "private", name: "Private Tennis Lesson", durationMin: 60, price: 85, blurb: "One-on-one." }],
    locations: [{ id: "mayfair", name: "Mayfair Parkway", city: "Markham", region: "ON", kind: "in-person" }],
  },
  {
    slug: "tim-zhang",
    name: "Tim Zhang",
    sport: "tennis",
    headline: "Private tennis · all levels. English / 中文.",
    city: "Markham",
    region: "ON",
    photo: "/photos/tim-zhang.jpg",
    languages: ["English", "中文"],
    bio: "Patient, structured lessons for juniors and adults.",
    notes: ["Bring your racquet and water."],
    lessons: [{ id: "private", name: "Private tennis", durationMin: 60, price: 80, blurb: "One-on-one." }],
    locations: [{ id: "blackmore", name: "Blackmore Tennis Club", city: "Markham", region: "ON", kind: "in-person" }],
  },
];
