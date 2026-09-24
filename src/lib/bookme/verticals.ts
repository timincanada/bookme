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

/** Discipline name typed under Other. The stored title adds " Coach". */
export const CUSTOM_DISCIPLINE_MAX = 40;

const OTHER_SUFFIX = "-other";

export type OtherVerticalId = `${VerticalGroupId}-other`;
/** Preset id, or a per-group custom id such as `music-other`. */
export type StoredSportId = VerticalId | OtherVerticalId;

const BY_ID = new Map(VERTICAL_ITEMS.map((item) => [item.id, item]));
const BY_LABEL = new Map(VERTICAL_ITEMS.map((item) => [item.label.toLowerCase(), item]));

export function otherVerticalId(groupId: VerticalGroupId): OtherVerticalId {
  return `${groupId}${OTHER_SUFFIX}`;
}

export function isOtherVerticalId(id: string | null | undefined): id is OtherVerticalId {
  if (!id?.endsWith(OTHER_SUFFIX)) return false;
  const groupId = id.slice(0, -OTHER_SUFFIX.length);
  return VERTICAL_GROUPS.some((g) => g.id === groupId);
}

export function verticalById(id: string | null | undefined) {
  if (!id || isOtherVerticalId(id)) return undefined;
  return BY_ID.get(id as VerticalId);
}

export function verticalByLabel(label: string | null | undefined) {
  if (!label) return undefined;
  return BY_LABEL.get(label.trim().toLowerCase());
}

export function groupForVertical(id: string | null | undefined) {
  if (!id) return undefined;
  if (isOtherVerticalId(id)) {
    const groupId = id.slice(0, -OTHER_SUFFIX.length);
    return VERTICAL_GROUPS.find((g) => g.id === groupId);
  }
  return VERTICAL_GROUPS.find((g) => g.items.some((item) => item.id === id));
}

export type PickerTile = {
  id: StoredSportId;
  label: string;
  blurb: string;
  custom: boolean;
};

/** Preset tiles for a category, then Other. Future groups pick this up automatically. */
export function tilesForGroup(groupId: VerticalGroupId): PickerTile[] {
  const group = VERTICAL_GROUPS.find((g) => g.id === groupId) ?? VERTICAL_GROUPS[0];
  return [
    ...group.items.map((item) => ({
      id: item.id as StoredSportId,
      label: item.label,
      blurb: item.blurb,
      custom: false,
    })),
    {
      id: otherVerticalId(group.id),
      label: "Other",
      blurb: "Name your own",
      custom: true,
    },
  ];
}

export function resolvePickerId(value: string | null | undefined): StoredSportId | null {
  if (!value) return null;
  if (isOtherVerticalId(value)) return value;
  return verticalById(value)?.id ?? verticalByLabel(value)?.id ?? null;
}

/**
 * Match a preset from a human title. Unknown labels use `sport-other`
 * (group unknown) — never tennis.
 */
export function sportFromTitle(title: string): StoredSportId {
  const t = title.toLowerCase();
  const ranked = [...VERTICAL_ITEMS].sort((a, b) => b.label.length - a.label.length);
  for (const item of ranked) {
    if (t.includes(item.label.toLowerCase()) || t.includes(item.id.replace(/-/g, " "))) return item.id;
  }
  return otherVerticalId("sport");
}

export function verticalLabel(id: string | null | undefined) {
  return verticalById(id)?.label ?? "Lesson";
}

/** Strip one trailing "Coach" so "Fencing Coach" reloads as "Fencing". */
export function disciplineFromTitle(title: string | null | undefined): string {
  return (title ?? "").trim().replace(/\s+coach$/i, "").trim();
}

export function titleFromDiscipline(discipline: string): string {
  return `${discipline.trim()} Coach`;
}

export function validateCustomDiscipline(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  // Drop a trailing "Coach" so the field and the stored title don't stack.
  // The word Coach by itself is the suffix, not a discipline.
  const trimmed = raw.trim();
  const value = trimmed.replace(/\s+coach$/i, "").trim();
  if (!value || /^coach$/i.test(trimmed)) return { ok: false, error: "Name your discipline" };
  if (value.length > CUSTOM_DISCIPLINE_MAX) {
    return { ok: false, error: `Keep your discipline under ${CUSTOM_DISCIPLINE_MAX} characters` };
  }
  return { ok: true, value };
}

export function coachBasicsFromSelection(
  id: string,
  label: string,
): { ok: true; sport: StoredSportId; title: string; discipline: string } | { ok: false; error: string } {
  if (isOtherVerticalId(id)) {
    const check = validateCustomDiscipline(label);
    if (!check.ok) return check;
    return { ok: true, sport: id, discipline: check.value, title: titleFromDiscipline(check.value) };
  }
  const item = verticalById(id) ?? verticalByLabel(label);
  if (!item) return { ok: false, error: "Pick what you coach" };
  return { ok: true, sport: item.id, discipline: item.label, title: titleFromDiscipline(item.label) };
}

/** Reopen setup: preset stays on its tile; custom reopens Other with the typed name. */
export function selectionFromCoach(
  title: string | null | undefined,
  sport: string | null | undefined,
): { id: StoredSportId; label: string; custom: boolean } {
  // No profile yet: same default as a new coach row (sport tennis).
  if (!sport && !title?.trim()) return { id: "tennis", label: "Tennis", custom: false };
  if (sport && isOtherVerticalId(sport)) {
    return { id: sport, label: disciplineFromTitle(title), custom: true };
  }
  const preset = sport ? verticalById(sport) : undefined;
  if (preset) return { id: preset.id, label: preset.label, custom: false };
  const discipline = disciplineFromTitle(title);
  const byLabel = discipline ? verticalByLabel(discipline) : undefined;
  if (byLabel) return { id: byLabel.id, label: byLabel.label, custom: false };
  const inferred = sportFromTitle(title?.trim() || discipline);
  if (!isOtherVerticalId(inferred)) {
    const item = verticalById(inferred);
    if (item) return { id: item.id, label: item.label, custom: false };
  }
  return { id: isOtherVerticalId(inferred) ? inferred : otherVerticalId("sport"), label: discipline, custom: true };
}

/**
 * Persist title + sport. An explicit `*-other` id wins over title text, so
 * "Table tennis" under Music stays music-other instead of becoming tennis.
 */
export function resolveStoredVertical(
  title: string,
  sport?: string | null,
): { ok: true; title: string; sport: StoredSportId } | { ok: false; error: string } {
  const trimmed = title.trim();
  if (sport && isOtherVerticalId(sport)) {
    const check = validateCustomDiscipline(disciplineFromTitle(trimmed));
    if (!check.ok) return check;
    return { ok: true, title: titleFromDiscipline(check.value), sport };
  }
  if (!trimmed) return { ok: false, error: "Pick a vertical" };
  const explicit = verticalById(sport);
  if (explicit) return { ok: true, title: trimmed, sport: explicit.id };
  const inferred = sportFromTitle(trimmed);
  if (isOtherVerticalId(inferred)) {
    const check = validateCustomDiscipline(disciplineFromTitle(trimmed));
    if (!check.ok) return check;
    return { ok: true, title: titleFromDiscipline(check.value), sport: inferred };
  }
  return { ok: true, title: trimmed, sport: inferred };
}

/** Chip / directory / admin label. Custom names stay custom; presets stay presets. */
export function specialtyLabel(sport: string | null | undefined, title?: string | null): string {
  if (isOtherVerticalId(sport)) return disciplineFromTitle(title) || "Coach";
  const preset = sport ? verticalById(sport) : undefined;
  if (preset) return preset.label;
  const fromTitle = disciplineFromTitle(title);
  const byLabel = fromTitle ? verticalByLabel(fromTitle) : undefined;
  if (byLabel) return byLabel.label;
  const inferred = sportFromTitle(`${fromTitle} ${title ?? ""}`.trim());
  if (!isOtherVerticalId(inferred)) return verticalById(inferred)?.label ?? (fromTitle || "Coach");
  return fromTitle || "Coach";
}

/** Wallet "SPORT / ROLE". Custom passes show the title, not the raw sport id. */
export function walletRoleLine(title?: string | null, sport?: string | null): string {
  const t = (title ?? "").trim();
  if (isOtherVerticalId(sport)) return t || specialtyLabel(sport, t);
  const label = specialtyLabel(sport, t);
  if (t && label && !t.toLowerCase().includes(label.toLowerCase())) return `${t} · ${label}`;
  return t || label || "Coach";
}

/** Service name from the human title. Never falls back to a raw sport id. */
export function privateLessonName(title: string, sport?: string | null): string {
  const named = disciplineFromTitle(title);
  if (named) return `Private ${named.toLowerCase()}`;
  const preset = sport ? verticalById(sport) : undefined;
  if (preset) return `Private ${preset.label.toLowerCase()}`;
  return "Private lesson";
}
