-- 0013 — Multi-select lesson durations per service.
-- Coaches may enable one or more of 30/45/60/90/120. The existing `duration`
-- column stays as the default (shortest enabled) for legacy readers; `durations`
-- is the full enabled set. One price still applies to every selected length.

alter table services
  add column if not exists durations int[];

update services
set durations = array[duration]
where durations is null;

alter table services
  alter column durations set default array[60];

alter table services
  alter column durations set not null;
