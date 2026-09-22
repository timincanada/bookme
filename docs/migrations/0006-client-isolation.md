# 0006 — Client isolation: deploy, verify, roll back

Migration: `migrations/0006_client_isolation.sql`
Code: `src/lib/bookme/clients-db.ts`, `src/lib/bookme/api.ts`
Test: `src/lib/bookme/client-isolation.test.ts`

Product rule: one student (one email) may book several coaches. Each coach owns
its own `clients` row for that student. Notes (and later payment notes) live
only on that row. `clients.email` is **not** globally unique.

## What the migration does (one transaction)

1. Creates `client_migration_log` (kept afterwards for review).
2. Adds `clients.coach_id` (FK → coaches, cascade) and drops `clients_email_key`.
3. Decides who keeps each existing client's original record:
   - lessons (any status) with exactly one coach → that coach keeps the
     original record and note, even if every lesson was cancelled;
   - several coaches → only valid lessons (`confirmed` / `completed`) count:
     owner = most valid lessons; tie → earliest valid lesson; still tied →
     lowest `coach_id`. Every other coach (including cancelled-only) gets a copy
     (`client_split`) and its lessons are repointed. Copies store the email in
     lower case;
   - several coaches, no valid lesson anywhere → every coach gets a copy and the
     original row is archived (`unattributed_archived`) and removed;
   - notes: lessons with exactly one coach → note stays with that coach's
     record; lessons with several coaches → author unknown, so the note is
     cleared everywhere and stored verbatim (`shared_note_cleared`);
   - no lessons at all → full row archived (`orphan_archived`) and removed.
   A row is only removed if its log row exists.
4. Aborts (whole migration rolls back) if one coach would end up with two rows
   whose emails differ only by case. Merge those by hand first.
5. `coach_id` NOT NULL; unique `(coach_id, lower(email))`; indexes on
   `coach_id` and `email`; `unique (id, coach_id)`; composite FK
   `lessons (client_id, coach_id) → clients (id, coach_id)`.

`clients.email` stays NOT NULL in this batch.

## Before deploying to production

1. Back up. Either:
   - Neon console: create a branch of the production branch (point-in-time
     copy), and note its name; or
   - `pg_dump --format=custom --no-owner "$DATABASE_URL" > bookme-pre-0006.dump`
2. Dry-run on the copy (optional but recommended):
   `DATABASE_URL=<branch url> npm run db:migrate`, then run the checks below
   against the branch.
3. Pre-check for the abort condition:

   ```sql
   select lower(email), count(*) from clients group by 1 having count(*) > 1;
   ```
   (Before 0006 this can only return rows for case variants.)

Deploy as usual (`npm run build` applies pending migrations).

## After deploying — verify

```sql
-- what the migration did
select kind, count(*) from client_migration_log
where migration = '0006_client_isolation' group by kind;

-- notes that need manual review (author unknown)
select client_id, coach_ids, email, name, note
from client_migration_log where kind = 'shared_note_cleared';

-- archived rows (no lessons / no valid lessons)
select kind, client_id, email, name, phone, note
from client_migration_log where kind in ('orphan_archived', 'unattributed_archived');

-- invariants (all should return 0)
select count(*) from clients where coach_id is null;
select count(*) from lessons l join clients c on c.id = l.client_id
where c.coach_id <> l.coach_id;
```

`client_migration_log` contains personal data (names, emails, phones, notes).
Decide how long to keep it once review is done.

## Rolling back

**Preferred: restore the backup** (Neon branch restore or `pg_restore`) and
redeploy the previous code. Anything written after the deploy is lost unless
re-entered.

**Manual down script** — only valid right after the deploy, before any
coach/student data was written by the new code. Revert the code first;
otherwise the next build re-applies 0006. It undoes only the most recent 0006
run (log rows of one run share `created_at`), so it stays correct if 0006 was
applied, rolled back and applied again. If the same email now exists under two
coaches, the final unique-email step fails and the whole script rolls back,
changing nothing — use the backup instead.

```sql
begin;
-- Undo only the most recent 0006 run (log rows of one run share created_at).
create temp table _undo0006 as
  select * from client_migration_log
  where migration = '0006_client_isolation'
    and created_at = (select max(created_at) from client_migration_log
                      where migration = '0006_client_isolation');
alter table lessons drop constraint if exists lessons_client_coach_fkey;
alter table clients drop constraint if exists clients_id_coach_id_key;
drop index if exists clients_coach_email_uidx;
drop index if exists clients_coach_id_idx;
drop index if exists clients_email_idx;
alter table clients alter column coach_id drop not null;
-- Bring archived originals back first: lessons are repointed to them next.
insert into clients (id, name, email, phone, note)
  select client_id, name, email, phone, coalesce(note, '')
  from _undo0006 where kind in ('orphan_archived', 'unattributed_archived')
  on conflict (id) do nothing;
update lessons l set client_id = g.client_id
  from _undo0006 g
  where g.kind = 'client_split' and l.client_id = g.new_client_id;
delete from clients c using _undo0006 g
  where g.kind = 'client_split' and c.id = g.new_client_id;
update clients c set note = g.note
  from _undo0006 g
  where g.kind = 'shared_note_cleared' and g.client_id = c.id;
alter table clients drop column coach_id;
alter table clients add constraint clients_email_key unique (email);
delete from _migrations where name = '0006_client_isolation.sql';
drop table _undo0006;
commit;
```

The log table is left in place after a rollback.

Verified on PGLite and on PostgreSQL 16 via `scripts/migrate.mjs` + `pg`:
- apply → down restores the exact pre-0006 clients, lessons, booking requests
  and payments; re-apply succeeds;
- apply → down → edit a note → apply → down restores the edited note;
- down after a new multi-coach client exists fails and changes nothing;
- `pg_restore` of the `pg_dump --format=custom` backup matches the pre-0006
  snapshot.
