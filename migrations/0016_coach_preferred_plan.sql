-- 0016 — Coach's chosen subscription plan while billing is paused.
-- Preference only. Does not start a Stripe subscription and does not change
-- coaches.plan, which still follows last month's confirmed lessons.

alter table coaches
  add column if not exists preferred_plan text;
