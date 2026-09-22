# BookMe — client isolation (0006) and time zones

## Client isolation (0006, merged)

- A student (one email / one login) may book many coaches. CRM is **per coach**: one
  `clients` row per (coach_id, student email). Notes and payment notes live only there.
  `clients.email` is **not** globally unique. Unique index `(coach_id, lower(email))`.
- Composite FK `lessons (client_id, coach_id) → clients (id, coach_id)`.
- Public (signed-out) booking touches only the current coach's row: keep existing name,
  fill phone only if empty, never overwrite notes/payment notes. Never error because the
  student already has another coach.
- Backfill ownership of historical shared rows:
  - valid lessons = `status in ('confirmed','completed')`; held/expired/cancelled never decide;
  - lessons (any status) with exactly one coach → that coach keeps the original id and note
    (even if all lessons were cancelled);
  - several coaches with ≥1 valid lesson → most valid lessons, tie → earliest valid lesson,
    then lowest coach_id; others get copies;
  - several coaches, no valid lesson → original row archived (`unattributed_archived`),
    one copy per coach, notes cleared;
  - notes with several coaches → cleared, original kept in `client_migration_log`
    (`shared_note_cleared`); no lessons at all → `orphan_archived`; nothing removed without a
    log row; same-coach case-variant duplicates abort the migration.
- New rows store lower-case email; historical emails are not rewritten.
- Rollback: restore backup preferred; manual down script in
  `docs/migrations/0006-client-isolation.md` (undoes latest run only; fails safely once new
  multi-coach rows exist).
- Coach-scoped helpers: `src/lib/bookme/clients-db.ts`.

## Time zones (merged with 0007)

- Store absolute instants; business zone is the coach's/studio's `coaches.timezone`.
- `time.ts` requires an explicit zone for every instant ↔ wall-clock conversion
  (`zonedInstantExact` returns null in spring-forward gaps; fall-back picks the earlier
  instant). Pure date-key helpers are zone-free.
- Applies to: import expansion and conflicts, `openSlots`, public booking page, booking,
  student self-service, requests, swaps, emails, reminders, coach calendars, assistant.
- `DEFAULT_TIMEZONE` remains only as a fallback/default value, never for time math.
- "Book same time next week" uses the same wall-clock time in the coach's zone.
