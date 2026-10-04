const QA_NAMES = [
  "bookme qa",
  "riley qa weather",
  "riley cash guest",
  "riley manage student",
];

/** Records that belong to fixtures, seeds, and QA inboxes — hidden when demo UI is off. */
export function isProductionQaRecord(input: { email?: string | null; name?: string | null }) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const name = String(input.name || "")
    .trim()
    .toLowerCase();
  if (email.endsWith("@bookme.test")) return true;
  if (email.includes("example.invalid")) return true;
  if (email.includes("mail.tm")) return true;
  if (name.includes("qa test")) return true;
  if (QA_NAMES.some((n) => name === n || name.startsWith(n + " "))) return true;
  if (name.startsWith("riley qa")) return true;
  return false;
}

export function hideQaRecords<T extends { email?: string | null; name?: string | null; clientEmail?: string | null; clientName?: string | null; studentName?: string | null }>(
  rows: T[],
  demo: boolean,
) {
  if (demo) return rows;
  return rows.filter(
    (row) =>
      !isProductionQaRecord({
        email: row.clientEmail || row.email,
        name: row.clientName || row.studentName || row.name,
      }),
  );
}
