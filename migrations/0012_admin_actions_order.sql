-- 0012 — Stable newest-first order for the admin audit log.
-- now() is the transaction timestamp, so back-to-back writes often share
-- created_at. id is a random uuid and cannot break that tie. seq is insert order.
-- Additive: databases that already applied 0011 pick the column up here.

create sequence if not exists admin_actions_seq;

alter table admin_actions
  add column if not exists seq bigint not null default nextval('admin_actions_seq');

alter sequence admin_actions_seq owned by admin_actions.seq;

drop index if exists admin_actions_created_idx;
create index admin_actions_created_idx on admin_actions (created_at desc, seq desc);

drop index if exists admin_actions_subject_idx;
create index admin_actions_subject_idx on admin_actions (subject_type, subject_id, created_at desc, seq desc);
