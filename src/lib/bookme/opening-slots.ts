/** One date group on an assistant openings card. `lines` stay for older clients and tests. */
export type OpeningGroup = {
  dateKey?: string;
  label: string;
  lines?: string[];
  times?: string[];
  location?: string;
};

export function openingGroupView(group: OpeningGroup) {
  const structured = (group.times || []).map((t) => String(t).trim()).filter(Boolean);
  if (structured.length) {
    return { times: structured, location: String(group.location || "").trim() };
  }
  const times: string[] = [];
  let location = "";
  for (const line of group.lines || []) {
    const parts = String(line)
      .split(" · ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) continue;
    times.push(parts[0]);
    const loc = parts.slice(1).join(" · ");
    if (loc && !location) location = loc;
    else if (loc && loc !== location) location = "";
  }
  return { times, location: String(group.location || location).trim() };
}

export function openingsAreStructured(groups: OpeningGroup[] | null | undefined) {
  return (groups || []).some((g) => openingGroupView(g).times.length > 0);
}

/** Chat bubble copy. Never repeat the raw time · location dump when chips exist. */
export function assistantVisibleText(
  text: string,
  card: { kind?: string; groups?: OpeningGroup[] } | null | undefined,
) {
  if (card?.kind === "openings" && openingsAreStructured(card.groups)) {
    return "Here are some available times.";
  }
  return text;
}

/** Phrase sent back through the existing assistant composer. */
export function slotSelectionPhrase(label: string, time: string) {
  return `${time} on ${label}`;
}
