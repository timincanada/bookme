-- 0009 — Mobile apps: push device tokens and account deletion.

alter table coaches add column if not exists deleted_at timestamptz;
alter table coaches add column if not exists purge_after timestamptz;
alter table coaches add column if not exists purged_at timestamptz;
create index if not exists coaches_purge_idx on coaches (purge_after) where deleted_at is not null and purged_at is null;

create table if not exists device_tokens (
  id text primary key,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique,
  coach_id text references coaches(id) on delete cascade,
  student_id text references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check ((coach_id is null) <> (student_id is null))
);
create index if not exists device_tokens_coach_idx on device_tokens (coach_id);
create index if not exists device_tokens_student_idx on device_tokens (student_id);

-- Audit trail without personal data.
create table if not exists account_deletions (
  id text primary key,
  kind text not null check (kind in ('coach', 'student')),
  subject_id text not null,
  requested_at timestamptz not null default now(),
  purge_after timestamptz,
  purged_at timestamptz
);
