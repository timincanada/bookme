export const SPEAK_MAX_CHARS = 400;

export function speakableText(text: string): string {
  return String(text || "")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s*\/\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function capSpokenText(text: string, max = SPEAK_MAX_CHARS): string {
  const cleaned = speakableText(text);
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const at = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("; "),
  );
  if (at >= Math.floor(max * 0.45)) return slice.slice(0, at + 1).trim();
  const word = slice.lastIndexOf(" ");
  return (word > 40 ? slice.slice(0, word) : slice).trim();
}

export function ttsLanguage(text: string): "zh" | "en" {
  return /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
}

export function audioFilename(mime = ""): string {
  const m = mime.toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "clip.m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "clip.mp3";
  if (m.includes("wav")) return "clip.wav";
  if (m.includes("ogg")) return "clip.ogg";
  return "clip.webm";
}

export function spokenFromTurn(res: {
  ok: boolean;
  message?: string;
  summary?: string;
  error?: string;
  needsConfirm?: boolean;
  preview?: { groups?: { label: string; lines: string[] }[] } | null;
}): string {
  if (!res.ok) return res.error || "Something went wrong.";
  if (res.needsConfirm) return res.summary || "I have a change ready. Confirm below.";
  const groups = res.preview?.groups;
  if (groups?.length) {
    const open = groups.filter((g) => g.lines.length);
    if (!open.length) return "No openings in that window.";
    const first = open[0];
    const sample = first.lines.slice(0, 3).join(", ");
    const moreDays = open.length - 1;
    if (moreDays > 0) return `${first.label}: ${sample}. Plus ${moreDays} more day${moreDays === 1 ? "" : "s"}.`;
    return `${first.label}: ${sample}.`;
  }
  return res.message || res.summary || "Done.";
}
