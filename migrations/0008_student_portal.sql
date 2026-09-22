-- 0008 — Student portal: email-code login, cookie sessions, coach ↔ student messages.
--
-- * One student identity per email (lower-case).
-- * Login codes / magic-link tokens are stored only as HMAC hashes, with an
--   attempt counter. In-flight plaintext codes and existing student sessions are
--   invalidated here: students sign in once more.
-- * Sessions live in an httpOnly cookie; only the token hash is stored.
-- * One conversation per (coach, coach's client record). Plain-text messages.

create table if not exists students (
  id text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists students_email_lower_uidx on students (lower(email));

-- Login codes / links
alter table manage_links alter column code drop not null;
alter table manage_links alter column token drop not null;
alter table manage_links add column if not exists code_hash text;
alter table manage_links add column if not exists token_hash text;
alter table manage_links add column if not exists attempts int not null default 0;
alter table manage_links add column if not exists request_ip text;
update manage_links set used_at = now() where used_at is null;
create unique index if not exists manage_links_token_hash_uidx on manage_links (token_hash);
create index if not exists manage_links_email_created_idx on manage_links (lower(email), created_at);
create index if not exists manage_links_ip_created_idx on manage_links (request_ip, created_at);

-- Sessions
alter table student_sessions add column if not exists token_hash text;
alter table student_sessions add column if not exists student_id text references students(id) on delete cascade;
alter table student_sessions add column if not exists created_at timestamptz not null default now();
alter table student_sessions add column if not exists last_seen_at timestamptz;
alter table student_sessions add column if not exists revoked_at timestamptz;
update student_sessions set expires_at = now() where expires_at > now();
create unique index if not exists student_sessions_token_hash_uidx on student_sessions (token_hash);

-- Case-insensitive student lookups (historical emails are not rewritten).
drop index if exists clients_email_idx;
create index if not exists clients_email_lower_idx on clients (lower(email));

-- Messaging
create table if not exists conversations (
  id text primary key,
  coach_id text not null references coaches(id) on delete cascade,
  client_id text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  coach_last_read_at timestamptz,
  student_last_read_at timestamptz,
  coach_notified_at timestamptz,
  student_notified_at timestamptz,
  constraint conversations_coach_client_key unique (coach_id, client_id),
  constraint conversations_client_coach_fkey
    foreign key (client_id, coach_id) references clients (id, coach_id) on delete cascade
);
create index if not exists conversations_client_idx on conversations (client_id);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('coach', 'student')),
  sender_student_id text references students(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_role = 'coach' or sender_student_id is not null)
);
create index if not exists messages_conversation_created_idx on messages (conversation_id, created_at);
create index if not exists messages_student_sender_idx on messages (sender_student_id, created_at);
