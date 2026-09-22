-- 0010 — Launch hardening.
-- 1. Remove the demo coaches that 0002 seeds, unless someone has claimed them or
--    they carry real activity. Local/preview (PGLite) re-adds them from
--    migrations/dev/seed.sql; production never has them.
-- 2. Table for Better Auth's database-backed rate limiting (sign-in/sign-up).

create temp table _seed_coaches as
select c.id from coaches c
where c.id in ('coach-tim-zhang', 'coach-daniel-kim', 'coach-maya-shah',
               'coach-sofia-reyes', 'coach-james-okafor', 'coach-priya-nair')
  and c.user_id is null
  and not exists (select 1 from lessons l where l.coach_id = c.id)
  and not exists (select 1 from clients cl where cl.coach_id = c.id)
  and not exists (select 1 from recurring_series s where s.coach_id = c.id);

delete from coaches where id in (select id from _seed_coaches);
drop table _seed_coaches;

create table if not exists "rateLimit" (
  id text primary key,
  key text not null unique,
  count integer not null,
  "lastRequest" bigint not null
);
