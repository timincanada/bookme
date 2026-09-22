export const VERTICAL_GROUPS = [
  {
    id: "sport",
    label: "Sport",
    items: [
      { id: "tennis", label: "Tennis", blurb: "Technique, rallies, match play" },
      { id: "soccer", label: "Soccer", blurb: "First touch, finishing, IQ" },
      { id: "basketball", label: "Basketball", blurb: "Shooting, footwork, game" },
      { id: "golf", label: "Golf", blurb: "Swing, short game, course" },
      { id: "swimming", label: "Swimming", blurb: "Stroke, starts, endurance" },
      { id: "hockey", label: "Hockey", blurb: "Skating, puck, systems" },
      { id: "pickleball", label: "Pickleball", blurb: "Dinks, drives, doubles" },
      { id: "badminton", label: "Badminton", blurb: "Clear, drop, footwork" },
      { id: "volleyball", label: "Volleyball", blurb: "Serve, set, defence" },
      { id: "martial-arts", label: "Martial arts", blurb: "Form, sparring, discipline" },
    ],
  },
  {
    id: "fitness",
    label: "Fitness",
    items: [
      { id: "fitness", label: "Personal training", blurb: "Strength, mobility, programs" },
      { id: "yoga", label: "Yoga", blurb: "Breath, flow, flexibility" },
      { id: "pilates", label: "Pilates", blurb: "Core, control, posture" },
      { id: "dance", label: "Dance", blurb: "Technique, rhythm, style" },
    ],
  },
  {
    id: "music",
    label: "Music",
    items: [
      { id: "piano", label: "Piano", blurb: "Repertoire, technique, theory" },
      { id: "voice", label: "Voice", blurb: "Tone, breath, performance" },
      { id: "guitar", label: "Guitar", blurb: "Chords, lead, songcraft" },
      { id: "violin", label: "Violin", blurb: "Bow, intonation, pieces" },
      { id: "music", label: "Music", blurb: "Theory, production, ensemble" },
    ],
  },
  {
    id: "arts",
    label: "Arts",
    items: [
      { id: "painting", label: "Painting", blurb: "Drawing, colour, studio" },
      { id: "photography", label: "Photography", blurb: "Light, composition, edit" },
      { id: "acting", label: "Acting", blurb: "Scene, voice, presence" },
    ],
  },
  {
    id: "academic",
    label: "Academic",
    items: [
      { id: "tutor", label: "Tutor", blurb: "School subjects, one-to-one" },
      { id: "languages", label: "Languages", blurb: "Conversation, grammar, exam" },
      { id: "coding", label: "Coding", blurb: "Projects, fundamentals, web" },
      { id: "chess", label: "Chess", blurb: "Openings, tactics, endgame" },
    ],
  },
] as const;

export type VerticalGroupId = (typeof VERTICAL_GROUPS)[number]["id"];
export type VerticalId = (typeof VERTICAL_GROUPS)[number]["items"][number]["id"];
export type VerticalItem = (typeof VERTICAL_GROUPS)[number]["items"][number];

export const VERTICAL_ITEMS: readonly VerticalItem[] = VERTICAL_GROUPS.flatMap((g) => [...g.items]);

export const VERTICALS = VERTICAL_ITEMS.map((item) => item.label);

const BY_ID = new Map(VERTICAL_ITEMS.map((item) => [item.id, item]));
const BY_LABEL = new Map(VERTICAL_ITEMS.map((item) => [item.label.toLowerCase(), item]));

export function verticalById(id: string | null | undefined) {
  if (!id) return undefined;
  return BY_ID.get(id as VerticalId);
}

export function verticalByLabel(label: string | null | undefined) {
  if (!label) return undefined;
  return BY_LABEL.get(label.trim().toLowerCase());
}

export function groupForVertical(id: string | null | undefined) {
  if (!id) return undefined;
  return VERTICAL_GROUPS.find((g) => g.items.some((item) => item.id === id));
}

export function sportFromTitle(title: string): VerticalId {
  const t = title.toLowerCase();
  const ranked = [...VERTICAL_ITEMS].sort((a, b) => b.label.length - a.label.length);
  for (const item of ranked) {
    if (t.includes(item.label.toLowerCase()) || t.includes(item.id.replace(/-/g, " "))) return item.id;
  }
  return "tennis";
}

export function verticalLabel(id: string | null | undefined) {
  return verticalById(id)?.label ?? "Lesson";
}
