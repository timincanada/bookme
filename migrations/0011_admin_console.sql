-- 0011 — Operations console: admin team, audit trail, job runs, reporting indexes.

-- staff = people who can open /admin. 'owner' (the founder) additionally manages
-- the team and the access/ban actions.
alter table staff add column if not exists role text not null default 'admin';
alter table staff add column if not exists added_by text;
alter table staff add column if not exists created_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_role_check') then
    alter table staff add constraint staff_role_check check (role in ('owner', 'admin'));
  end if;
end $$;
insert into staff (id, email, role) values ('staff-owner', 'zhouxiyin1024@gmail.com', 'owner')
  on conflict (email) do update set role = 'owner';

-- Every write an admin makes is recorded.
create table if not exists admin_actions (
  id text primary key,
  actor_email text not null,
  actor_role text not null,
  kind text not null,
  subject_type text not null,
  subject_id text not null,
  detail text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on admin_actions (created_at desc);
create index if not exists admin_actions_subject_idx on admin_actions (subject_type, subject_id, created_at desc);

-- Background job runs (reminders, purges) so the console can show freshness.
create table if not exists job_runs (
  id text primary key,
  job text not null,
  ran_at timestamptz not null default now(),
  ok boolean not null default true,
  detail text not null default ''
);
create index if not exists job_runs_job_idx on job_runs (job, ran_at desc);

-- Reporting indexes.
create index if not exists lessons_start_at_idx on lessons (start_at);
create index if not exists lessons_coach_start_idx on lessons (coach_id, start_at);
create index if not exists payments_status_idx on payments (status);
