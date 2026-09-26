-- 0017 — Assistant chat history.
-- One thread per coach. Owning coach only (queries filter on coach_id).
-- Additive: new table and index. No changes to existing tables.

create table if not exists assistant_messages (
  id text primary key,
  coach_id text not null references coaches(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null default '',
  card jsonb,
  source text check (source in ('text', 'voice')),
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_coach_created_idx
  on assistant_messages (coach_id, created_at desc);
