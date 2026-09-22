# Production deploy: migrations 0006 → 0007 → 0008

Covers `0006_client_isolation.sql`, `0007_recurring_series.sql`,
`0008_student_portal.sql` and the code that ships with them. Details of 0006's
data handling and its manual rollback: `docs/migrations/0006-client-isolation.md`.

## 0. How the migrations run

- `npm run build` (Vercel) runs `vite build`, then `scripts/migrate.mjs` against
  `DATABASE_URL`. Pending files apply in name order; each file runs in its own
  transaction and is recorded in `_migrations`.
- If a file fails, it rolls back completely and the build fails; files before it
  stay applied. Example: 0006 applied, 0007 failed → the database is at 0006.
  Check `_migrations` before deciding what to roll back.
- The new code needs all three migrations; the old code breaks once 0006 is
  applied (it inserts clients without `coach_id`). While the build migrates, the
  previous deployment still serves traffic, so public booking and `/manage` can
  error for a short time. Deploy in a quiet hour.

## 1. Before deploying

### 1.1 Environment (Vercel → Production)

| Variable | Required | Why |
|---|---|---|
| `DATABASE_URL` | yes | Neon |
| `BETTER_AUTH_SECRET` | yes, ≥ 32 random chars | Also keys the hashes of student login codes and sessions. Student sign-in refuses to run without it in production. Changing it later invalidates every student code and session |
| `RESEND_API_KEY` | yes | Student login codes are only delivered by email; they are never shown in the browser in production |
| `MAIL_FROM` | recommended | Sender for codes and message notices |
| `BOOKME_APP_URL` | yes | Links in code, reminder and message emails |
| `BOOKME_DEV_SHOW_CODE` | **must be unset** | Development-only switch |
| `CRON_SECRET` | recommended | Reminders now also go to imported recurring lessons |

### 1.2 Pre-checks (read-only, on production)

```sql
-- where the database is now (expect 0001–0005, or up to 0006/0007 if partly deployed)
select name, applied_at from _migrations order by name;

-- 0006 aborts if one coach would have two clients whose emails differ only by case
select lower(email), count(*) from clients group by 1 having count(*) > 1;

-- a coach whose slug is "s" would be shadowed by the new /s short link
select id, name, slug from coaches where slug = 's';

-- size of what 0006 will touch
select
  (select count(*) from clients) as clients,
  (select count(*) from lessons) as lessons,
  (select count(*) from manage_links where used_at is null and expires_at > now()) as open_codes,
  (select count(*) from student_sessions where expires_at > now()) as live_student_sessions;
```

If the case-duplicate query returns rows, merge those clients by hand first. If a
coach has slug `s`, decide what to do with that coach's link before deploying.

### 1.3 Backup

Take one of these right before deploying and note its name/time:

- Neon console: create a branch of the production branch (point-in-time copy).
- or `pg_dump --format=custom --no-owner "$DATABASE_URL" -f bookme-pre-0006-0008.dump`

### 1.4 Dry run (recommended)

Against the backup branch:

```bash
DATABASE_URL="<branch url>" npm run db:migrate
```

Expect `applied 0006_client_isolation.sql`, `applied 0007_recurring_series.sql`,
`applied 0008_student_portal.sql`. Then run the checks in section 3 against the
branch.

## 2. Deploy

1. Deploy the commit that contains 0006–0008 (normal Vercel production deploy).
   The build log must show the three `applied …` lines, or `up to date` if a dry
   run was pointed at production by mistake.
2. Or migrate first, then deploy immediately:
   ```bash
   DATABASE_URL="<production url>" npm run db:migrate
   ```
   followed by the production deploy. Keep the gap as short as possible (see 0).

## 3. After migrating: SQL checks

All queries are read-only. Expected results are in the comments.

```sql
-- all three applied
select name from _migrations
where name in ('0006_client_isolation.sql','0007_recurring_series.sql','0008_student_portal.sql')
order by name;                                                         -- 3 rows

-- 0006: every client belongs to a coach; lessons match their client's coach
select count(*) from clients where coach_id is null;                  -- 0
select count(*) from lessons l join clients c on c.id = l.client_id
where c.coach_id <> l.coach_id;                                        -- 0
select kind, count(*) from client_migration_log
where migration = '0006_client_isolation' group by kind;              -- review
select client_id, coach_ids, email, name, note
from client_migration_log where kind = 'shared_note_cleared';         -- notes to review by hand
select kind, client_id, email, name, phone, note
from client_migration_log where kind in ('orphan_archived', 'unattributed_archived');

-- 0007: new tables exist and are empty; existing lessons are ordinary bookings
select count(*) from recurring_series;                                 -- 0
select count(*) from recurring_slots;                                  -- 0
select source, count(*) from lessons group by source;                  -- only 'booking'
select count(*) from lessons where duration_min is not null;           -- 0
select conname from pg_constraint
where conname in ('lessons_series_coach_fkey','lessons_imported_has_series_check',
                  'recurring_series_span_check','recurring_series_client_coach_fkey');  -- 4 rows

-- 0008: old codes and sessions are no longer usable
select count(*) from manage_links where used_at is null;               -- 0
select count(*) from student_sessions where expires_at > now();        -- 0
select count(*) from manage_links where code_hash is null and used_at is null;  -- 0
select count(*) from students;                                         -- 0 right after migrating
select count(*) from conversations;                                    -- 0
select count(*) from messages;                                         -- 0
select indexname from pg_indexes
where indexname in ('students_email_lower_uidx','manage_links_token_hash_uidx',
                    'student_sessions_token_hash_uidx','clients_email_lower_idx',
                    'messages_conversation_created_idx');              -- 5 rows
select count(*) from pg_indexes where indexname = 'clients_email_idx';  -- 0

-- codes issued by the new code carry no plain text (run again a day later)
select count(*) from manage_links
where code_hash is not null and (code is not null or token is not null);  -- 0
```

`client_migration_log` holds names, emails, phones and notes. Delete it once the
review is done.

## 4. After deploying: smoke test (production)

1. Public booking page of a real coach loads; a cash test booking succeeds (cancel it after).
2. `/s` redirects to `/manage`.
3. `/manage` with a real student email: the email arrives with a link and a 6-digit
   code; the code signs in; lessons from every coach for that email are listed.
4. Messages: the student sees coaches with a confirmed lesson; a message appears in
   the coach's `/app/messages` with an unread badge on More; the reply shows in the
   portal; each side gets at most one notice email per 10 minutes, without the text.
5. Sign out in the portal, then reload `/manage`: signed out.
6. Coach app: `/app/import` loads (no need to save), client and lesson pages show
   the Message entry.
7. Vercel function logs: no `mail_skipped_no_recipient` spikes, no 500s on
   `/_serverFn/`.

## 5. Students must sign in again

0008 invalidates every open login link/code and every student session. Nothing
else is lost. Students request a new code at `/manage` (or `/s`). Old "manage your
lessons" links in past emails still open `/manage`; old one-time links inside them
no longer sign anyone in.

Suggested note for coaches to forward:

> We've updated BookMe's student page. Next time you open it, enter your booking
> email and we'll send you a 6-digit code. You can now also message your coach there.

## 6. Rollback

### 6.1 Preferred: restore the backup

1. Redeploy the previous production commit (the code before 0006).
2. Restore the Neon branch from 1.3 (or `pg_restore --clean --no-owner -d "$DATABASE_URL" bookme-pre-0006-0008.dump`).
3. Anything written after the deploy (bookings, imports, messages, sign-ins) is
   lost and must be re-entered.

### 6.2 Manual, one step at a time (only right after deploying)

Undo in reverse order: 0008, then 0007, then 0006. Deploy the code that matches the
remaining schema; otherwise the next build re-applies the undone file. Each script
refuses to run once the step's new data exists, and then changes nothing — use the
backup instead.

**Undo 0008** (refuses if any message exists)

```sql
begin;
do $$ begin
  if exists (select 1 from messages) then
    raise exception 'messages exist; restore the backup instead';
  end if;
end $$;
drop table messages;
drop table conversations;
drop index if exists clients_email_lower_idx;
create index if not exists clients_email_idx on clients (email);
drop index if exists student_sessions_token_hash_uidx;
update student_sessions set expires_at = least(expires_at, now());
alter table student_sessions
  drop column revoked_at, drop column last_seen_at, drop column created_at,
  drop column student_id, drop column token_hash;
drop index if exists manage_links_ip_created_idx;
drop index if exists manage_links_email_created_idx;
drop index if exists manage_links_token_hash_uidx;
-- codes issued by the new code have no plaintext; the old code can't use them
delete from manage_links where code is null or token is null;
alter table manage_links
  drop column request_ip, drop column attempts, drop column token_hash, drop column code_hash;
alter table manage_links alter column code set not null;
alter table manage_links alter column token set not null;
drop table students;
delete from _migrations where name = '0008_student_portal.sql';
commit;
```

Students signed in since the deploy are signed out again.

**Undo 0007** (refuses if any recurring import or email-less client exists)

```sql
begin;
do $$ begin
  if exists (select 1 from recurring_series)
     or exists (select 1 from lessons where source <> 'booking')
     or exists (select 1 from clients where email is null) then
    raise exception 'recurring imports exist; restore the backup instead';
  end if;
end $$;
alter table lessons drop constraint lessons_imported_has_series_check;
alter table lessons drop constraint lessons_series_coach_fkey;
drop index if exists lessons_series_id_idx;
alter table lessons
  drop column duration_min, drop column slot_id, drop column series_id, drop column source;
drop table recurring_slots;
drop table recurring_series;
alter table clients
  drop column split_ratio, drop column payment_note, drop column payment_status;
alter table clients alter column email set not null;
delete from _migrations where name = '0007_recurring_series.sql';
commit;
```

Client payment notes entered since the deploy are dropped.

**Undo 0006**: the down script in `docs/migrations/0006-client-isolation.md`. It
fails and changes nothing once the same email exists under two coaches.

After a manual rollback, rerun the matching checks from section 3 (the earlier
files' queries should still pass) and redeploy the matching code.
