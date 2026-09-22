-- Demo coaches for local/preview (PGLite) only. Applied by src/lib/db.ts after migrations,
-- only when missing. Production databases never get these (0010 removes the copies 0002 inserts).
-- Seed marketplace coaches (unowned public profiles). Always bookable.
insert into coaches (
  id, slug, name, title, sport, city, timezone, languages, photo_url, headline, bio, notes, email,
  subscription_status, plan, access_grant, accept_card, accept_cash
) values
(
  'coach-tim-zhang', 'tim-zhang', 'Tim Zhang', 'Tennis Coach', 'tennis', 'Markham, ON', 'America/Toronto',
  'English / 中文', '/photos/tim-zhang.jpg',
  'Private tennis · all levels. English / 中文.',
  'Patient, structured lessons for juniors and adults. Technique, match play, and confidence — in person or online.',
  'Bring your racquet and water.' || chr(10) || 'Lessons available in English or 中文.' || chr(10) || 'Free cancellation up to 24 hours before.',
  'tim@bookme.test', 'active', 'light', 'paid', true, true
),
(
  'coach-daniel-kim', 'daniel-kim', 'Daniel Kim', 'Tennis Coach', 'tennis', 'Markham, ON', 'America/Toronto',
  'English', '/photos/daniel-kim.jpg',
  'Private tennis for every level — technique, match play, and confidence.',
  'Former varsity player coaching juniors and adults on the Mayfair courts. Sessions are focused, personal, and built around how you actually play.',
  'Bring your racquet and water.' || chr(10) || 'Free cancellation up to 24 hours before your lesson.',
  'daniel@bookme.test', 'active', 'light', 'paid', true, true
),
(
  'coach-maya-shah', 'maya-shah', 'Maya Shah', 'Fitness Coach', 'fitness', 'Toronto, ON', 'America/Toronto',
  'English', '/photos/maya-shah.jpg',
  'Strength, mobility, and programs that fit a real week.',
  'Independent trainer working 1:1 in parks and studios across midtown. Clear programming, no bootcamp theatrics.',
  'Wear training shoes and bring water.' || chr(10) || 'Free cancellation up to 24 hours before.',
  'maya@bookme.test', 'active', 'light', 'paid', true, true
),
(
  'coach-sofia-reyes', 'sofia-reyes', 'Sofia Reyes', 'Soccer Coach', 'soccer', 'Vaughan, ON', 'America/Toronto',
  'English, Spanish', '/photos/sofia-reyes.jpg',
  'Technical soccer for kids and adults who want cleaner first touches.',
  'UEFA-inspired footwork, finishing, and game IQ. Small-group and private sessions on club fields.',
  'Bring boots and a ball if you have one.' || chr(10) || 'Free cancellation up to 24 hours before.',
  'sofia@bookme.test', 'active', 'light', 'paid', true, true
),
(
  'coach-james-okafor', 'james-okafor', 'James Okafor', 'Golf Coach', 'golf', 'Oakville, ON', 'America/Toronto',
  'English', '/photos/james-okafor.jpg',
  'A quiet, repeatable swing — short game first.',
  'Club-fit lessons on the range and the course. Adults who are tired of quick tips and want a swing they can trust.',
  'Clubs provided if needed.' || chr(10) || 'Free cancellation up to 24 hours before.',
  'james@bookme.test', 'active', 'light', 'paid', true, true
),
(
  'coach-priya-nair', 'priya-nair', 'Priya Nair', 'Swimming Coach', 'swimming', 'Markham, ON', 'America/Toronto',
  'English', '/photos/priya-nair.jpg',
  'Stroke work for adults and confident kids in the water.',
  'Former varsity swimmer teaching efficient freestyle, starts, and endurance. Calm decks, clear cues.',
  'Bring goggles and a cap.' || chr(10) || 'Free cancellation up to 24 hours before.',
  'priya@bookme.test', 'active', 'light', 'paid', true, true
)
on conflict (id) do nothing;

insert into services (id, coach_id, name, duration, price_cad) values
  ('svc-tim-private', 'coach-tim-zhang', 'Private tennis', 60, 80),
  ('svc-daniel-private', 'coach-daniel-kim', 'Private Tennis Lesson', 60, 85),
  ('svc-daniel-clinic', 'coach-daniel-kim', 'Hitting Clinic', 60, 45),
  ('svc-maya-pt', 'coach-maya-shah', 'Personal training', 45, 90),
  ('svc-sofia-private', 'coach-sofia-reyes', 'Private soccer session', 60, 65),
  ('svc-james-private', 'coach-james-okafor', 'Private golf lesson', 60, 120),
  ('svc-priya-private', 'coach-priya-nair', 'Private swim lesson', 45, 80)
on conflict (id) do nothing;

insert into locations (id, coach_id, name, address, kind, active) values
  ('loc-tim-blackmore', 'coach-tim-zhang', 'Blackmore Tennis Club', '1720 Bur Oak Ave, Markham', 'in_person', true),
  ('loc-tim-mayfair', 'coach-tim-zhang', 'Mayfair Clubs', '50 Steelcase Rd, Markham', 'in_person', true),
  ('loc-tim-online', 'coach-tim-zhang', 'Online', 'Video lesson', 'online', true),
  ('loc-daniel-mayfair', 'coach-daniel-kim', 'Mayfair Parkway', 'Markham, ON', 'in_person', true),
  ('loc-daniel-online', 'coach-daniel-kim', 'Video review', 'Online', 'online', true),
  ('loc-maya-park', 'coach-maya-shah', 'David A. Balfour Park', 'Toronto, ON', 'in_person', true),
  ('loc-maya-online', 'coach-maya-shah', 'Online', 'Online', 'online', true),
  ('loc-sofia-maple', 'coach-sofia-reyes', 'Maple Community Fields', 'Vaughan, ON', 'in_person', true),
  ('loc-james-glen', 'coach-james-okafor', 'Glen Abbey range', 'Oakville, ON', 'in_person', true),
  ('loc-priya-panam', 'coach-priya-nair', 'Markham Pan Am Centre', 'Markham, ON', 'in_person', true)
on conflict (id) do nothing;

insert into weekly_hours (id, coach_id, weekday, start_min, end_min)
select 'wh-' || c.id || '-' || w.d, c.id, w.d, 600, 1200
from coaches c
cross join (values (1),(2),(3),(4),(5)) as w(d)
on conflict (id) do nothing;
