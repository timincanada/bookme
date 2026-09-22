-- 0007 — Coach-side import of existing students' recurring schedules.
--
-- A series is a set of weekly "weekday + wall-clock time" slots repeated every
-- week or every other week between start_date and end_date (inclusive; at most
-- start_date + 6 calendar months), expanded in the coach's time zone into
-- ordinary confirmed lessons (source = 'imported_recurring'). Nothing here
-- creates Stripe charges: imported lessons get payments.method = 'offline',
-- status = 'not_tracked'. Payment fields below are CRM notes only.

-- Clients without an email may be created by an import (no portal login).
alter table clients alter column email drop not null;

alter table clients add column if not exists payment_status text
  check (payment_status in ('unpaid', 'pay_per_lesson', 'prepaid_package', 'monthly', 'split', 'outside_platform', 'settled'));
alter table clients add column if not exists payment_note text not null default '';
alter table clients add column if not exists split_ratio text not null default '';

create table if not exists recurring_series (
  id text primary key,
  coach_id text not null references coaches(id) on delete cascade,
  client_id text not null,
  service_id text not null references services(id),
  location_id text not null references locations(id),
  interval_weeks int not null check (interval_weeks in (1, 2)),
  start_date date not null,
  end_date date not null,
  timezone text not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  ended_from date,
  ended_at timestamptz,
  payment_status text
    check (payment_status in ('unpaid', 'pay_per_lesson', 'prepaid_package', 'monthly', 'split', 'outside_platform', 'settled')),
  payment_note text not null default '',
  split_ratio text not null default '',
  notify_student boolean not null default false,
  created_via text not null check (created_via in ('form', 'assistant')),
  lesson_count int not null default 0,
  skipped_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint recurring_series_span_check
    check (end_date >= start_date and end_date <= (start_date + interval '6 months')::date),
  constraint recurring_series_id_coach_key unique (id, coach_id),
  constraint recurring_series_client_coach_fkey
    foreign key (client_id, coach_id) references clients (id, coach_id)
);
create index if not exists recurring_series_coach_idx on recurring_series (coach_id, status);
create index if not exists recurring_series_client_idx on recurring_series (client_id);

create table if not exists recurring_slots (
  id text primary key,
  series_id text not null references recurring_series(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_min int not null check (start_min between 0 and 1439),
  duration_min int not null check (duration_min in (30, 45, 60, 90, 120)),
  check (start_min + duration_min <= 1440),
  unique (series_id, weekday, start_min)
);

alter table lessons add column if not exists source text not null default 'booking'
  check (source in ('booking', 'imported_recurring'));
alter table lessons add column if not exists series_id text;
alter table lessons add column if not exists slot_id text references recurring_slots(id) on delete set null;
alter table lessons add column if not exists duration_min int
  check (duration_min in (30, 45, 60, 90, 120));

alter table lessons
  add constraint lessons_series_coach_fkey
  foreign key (series_id, coach_id) references recurring_series (id, coach_id);
alter table lessons
  add constraint lessons_imported_has_series_check
  check (source <> 'imported_recurring' or series_id is not null);

create index if not exists lessons_series_id_idx on lessons (series_id);
