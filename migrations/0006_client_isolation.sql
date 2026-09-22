-- 0006 — Client isolation: one CRM record per (coach, student email).
--
-- Product rule: a student (one email / one login) may take lessons with many
-- coaches. Each coach owns a separate `clients` row for that student; notes and
-- (later) payment notes live only on that row and are never read or written
-- across coaches. `clients.email` is therefore NOT globally unique.
--
-- Data rules for rows that existed before this migration. Only VALID lessons
-- (status in ('confirmed', 'completed')) decide ownership when a student has
-- lessons with several coaches; held, expired and cancelled lessons never do.
--   * Lessons (any status) with exactly one coach -> that coach keeps the
--     original record and its note, even if every lesson was cancelled.
--   * Several coaches, at least one valid lesson -> owner = coach with the most
--     valid lessons; tie -> earliest valid lesson; still tied -> lowest
--     coach_id. The owner keeps the original id. Every other coach (any status,
--     including cancelled-only) gets its own copy; its lessons are repointed.
--   * Several coaches, no valid lesson anywhere -> nobody keeps the original:
--     each coach gets a copy and the original row is archived in
--     client_migration_log (kind = 'unattributed_archived') before removal.
--     The earliest (cancelled) lesson does not decide anything.
--   * Notes: lessons (any status) with exactly one coach -> the note stays with
--     that coach's record. Lessons with several coaches -> the note has no known
--     author: cleared everywhere, kept verbatim in the log
--     (kind = 'shared_note_cleared').
--   * No lessons at all (orphan) -> nothing identifies a coach, so the full row
--     is archived (kind = 'orphan_archived') before removal.
--   * Rows are only removed if their log row exists.
--   * New rows written here (copies) store the email in lower case. Existing
--     rows keep their email as is.
--   * Two rows for the same coach whose emails differ only by case -> the
--     migration aborts; merge them by hand first. No silent merge.
--
-- Applied in one transaction by scripts/migrate.mjs (Neon) and src/lib/db.ts
-- (PGLite). Back up production before deploying. Rollback notes:
-- docs/migrations/0006-client-isolation.md

create table if not exists client_migration_log (
  id text primary key,
  migration text not null,
  kind text not null,
  client_id text not null,
  new_client_id text,
  coach_id text,
  coach_ids text,
  email text,
  name text,
  phone text,
  note text,
  created_at timestamptz not null default now()
);

alter table clients add column if not exists coach_id text references coaches(id) on delete cascade;

-- The global unique email blocks one student having rows under several coaches.
alter table clients drop constraint if exists clients_email_key;

create temp table _mig0006_client_coach as
select l.client_id,
       l.coach_id,
       count(*) filter (where l.status in ('confirmed', 'completed')) as valid_n,
       min(l.start_at) filter (where l.status in ('confirmed', 'completed')) as first_valid_at
from lessons l
group by l.client_id, l.coach_id;

-- Owner: the only coach the student ever had lessons with, or else the best
-- coach by valid lessons. Several coaches with no valid lesson -> no owner.
create temp table _mig0006_owner as
select distinct on (cc.client_id) cc.client_id, cc.coach_id
from _mig0006_client_coach cc
where cc.valid_n > 0
   or not exists (
     select 1 from _mig0006_client_coach other
     where other.client_id = cc.client_id and other.coach_id <> cc.coach_id
   )
order by cc.client_id, cc.valid_n desc, cc.first_valid_at asc nulls last, cc.coach_id asc;

create temp table _mig0006_multi as
select client_id, string_agg(coach_id, ',' order by coach_id) as coach_ids
from _mig0006_client_coach
group by client_id
having count(*) > 1;

-- 1. Shared notes: log verbatim, then clear (author unknown).
insert into client_migration_log (id, migration, kind, client_id, coach_ids, email, name, phone, note)
select gen_random_uuid()::text, '0006_client_isolation', 'shared_note_cleared',
       c.id, m.coach_ids, c.email, c.name, c.phone, c.note
from clients c
join _mig0006_multi m on m.client_id = c.id
where coalesce(c.note, '') <> '';

update clients c
set note = ''
from _mig0006_multi m
where m.client_id = c.id and coalesce(c.note, '') <> '';

-- 2. Original row -> owning coach.
update clients c
set coach_id = o.coach_id
from _mig0006_owner o
where o.client_id = c.id and c.coach_id is null;

-- 3. A copy for every other coach (all coaches when there is no owner);
--    repoint that coach's lessons. Shared notes were cleared in step 1, so
--    copying the note only carries it for single-coach students.
create temp table _mig0006_split as
select cc.client_id as old_id, cc.coach_id, gen_random_uuid()::text as new_id
from _mig0006_client_coach cc
left join _mig0006_owner o on o.client_id = cc.client_id
where o.coach_id is distinct from cc.coach_id;

insert into clients (id, coach_id, name, email, phone, note)
select s.new_id, s.coach_id, c.name, lower(c.email), c.phone, c.note
from _mig0006_split s
join clients c on c.id = s.old_id;

insert into client_migration_log (id, migration, kind, client_id, new_client_id, coach_id, email, name)
select gen_random_uuid()::text, '0006_client_isolation', 'client_split',
       s.old_id, s.new_id, s.coach_id, lower(c.email), c.name
from _mig0006_split s
join clients c on c.id = s.old_id;

update lessons l
set client_id = s.new_id
from _mig0006_split s
where l.client_id = s.old_id and l.coach_id = s.coach_id;

-- 4. Rows no coach owns: archive the full row, then remove it.
--    'unattributed_archived' = lessons with several coaches, none valid
--                              (all lessons now moved to copies);
--    'orphan_archived'       = never had lessons.
insert into client_migration_log (id, migration, kind, client_id, email, name, phone, note)
select gen_random_uuid()::text, '0006_client_isolation',
       case when exists (select 1 from _mig0006_client_coach cc where cc.client_id = c.id)
            then 'unattributed_archived' else 'orphan_archived' end,
       c.id, c.email, c.name, c.phone, c.note
from clients c
where c.coach_id is null;

delete from clients c
where c.coach_id is null
  and exists (
    select 1 from client_migration_log g
    where g.kind in ('orphan_archived', 'unattributed_archived') and g.client_id = c.id
  );

drop table _mig0006_split;
drop table _mig0006_multi;
drop table _mig0006_owner;
drop table _mig0006_client_coach;

-- 5. Refuse to guess on same-coach case-variant duplicates.
do $$
declare
  dup int;
begin
  select count(*) into dup
  from (
    select coach_id, lower(email)
    from clients
    group by coach_id, lower(email)
    having count(*) > 1
  ) d;
  if dup > 0 then
    raise exception '0006_client_isolation: % coach/email pair(s) differ only by case; merge them manually before migrating', dup;
  end if;
end $$;

-- 6. Constraints.
alter table clients alter column coach_id set not null;

create unique index if not exists clients_coach_email_uidx on clients (coach_id, lower(email));
create index if not exists clients_coach_id_idx on clients (coach_id);
create index if not exists clients_email_idx on clients (email);

alter table clients add constraint clients_id_coach_id_key unique (id, coach_id);

-- A lesson's client must belong to the lesson's coach.
alter table lessons
  add constraint lessons_client_coach_fkey
  foreign key (client_id, coach_id) references clients (id, coach_id);
