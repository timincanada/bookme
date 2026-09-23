-- 0014 — Venue weather asks.
-- One open ask per lesson. Coach keep closes it; coach cancel reuses the
-- existing lesson-cancel refund and then marks the ask cancelled.

create table if not exists weather_asks (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  coach_id text not null references coaches(id) on delete cascade,
  opened_by text not null check (opened_by in ('coach', 'student')),
  signals jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'keep', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists weather_asks_one_open
  on weather_asks (lesson_id)
  where status = 'open';

create index if not exists weather_asks_lesson_idx
  on weather_asks (lesson_id, created_at desc);
