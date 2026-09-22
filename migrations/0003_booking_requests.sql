create table if not exists booking_requests (
  id text primary key,
  coach_id text not null references coaches(id) on delete cascade,
  kind text not null,
  status text not null default 'pending',
  lesson_id text not null references lessons(id) on delete cascade,
  other_lesson_id text references lessons(id) on delete set null,
  proposed_start timestamptz,
  note text not null default '',
  created_by text not null default 'student',
  student_token text unique,
  other_token text unique,
  student_decision text not null default 'pending',
  other_decision text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists booking_requests_coach_status_idx on booking_requests (coach_id, status);
create index if not exists booking_requests_lesson_idx on booking_requests (lesson_id);
