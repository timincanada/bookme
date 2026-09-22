# BookMe — product, brand, platform, batch status

## Product and brand

- BookMe = booking + payments + client CRM for independent coaches (tennis, soccer, golf,
  fitness, swimming, music, tutoring…). Tagline: "More time coaching. Less time scheduling."
  Not a general calendar, not a game, not a social app.
- v1 coach side is **single service** (one lesson type). The schema may hold several
  services; no multi-service settings or scheduling UI.
- Lesson lengths: **30 / 45 / 60 / 90 / 120** only (`LESSON_DURATIONS` in
  `recurring.ts`; `setup.ts` re-exports it as `DURATIONS`; server validates with
  `isLessonDuration`). No free-form 15–240.
- Brand: warm editorial / paper magazine — calm, premium, restrained. Cream paper + deep
  green ink. Fonts Fraunces (display) + Figtree (body). No neon, purple, gold, playful
  gradients, game styling, emoji piles, phone mockups as hero; never call the product a game.
- UI copy and emails are English; no i18n yet. Assistant recaps follow the coach's language.
- "Messages" is a real product area: in-app student ↔ coach conversation (next batch). The
  assistant's "email a student" is only a notification channel, not a replacement.

## Platform and deployment

- Deploy target: **Vercel** (Nitro preset). Postgres on Neon; PGLite for local/preview.
- Migrations: `migrations/*.sql`, applied once each by `scripts/migrate.mjs` (build) and
  `src/lib/db.ts` (PGLite). `migrations/auth/0001_auth.sql` is a duplicate template; the
  applied path is `migrations/0001_auth.sql`. Never apply both.
- **Grok leftovers are a separate batch** and must not be extended meanwhile:
  `scripts/grok-pwa*`, `server/middleware/grok-pwa.ts` (injects grok.com script + manifest
  into every page), `lib/auth/gate-identity*`, `preview-host-bridge`, `lib/multiplayer`,
  `lib/app-data`, Google/X sign-in via the `GROK_AUTH_*` broker, 17 failing Grok template
  tests, preview iframe cookie limits.
- xAI realtime voice / server transcription: unchanged; not part of any current batch.
  Don't treat Chrome Web Speech → Google as an acceptable default channel.

## Batch status

| Batch | Status | Notes |
|---|---|---|
| Architecture review | done | don't repeat |
| Client isolation (0006) | **merged** | isolation.md |
| Recurring import + time zones (0007) | **merged** | isolation.md, import.md; closed scope |
| Student portal + email-code login + messages (0008) | rules locked (P1–P18), code in progress | portal-messaging.md |
| Grok leftovers | not started | separate batch |
| Refund implementation | not started | policy in product.md |

## Data facts (production)

- Production has **no seed coaches** (Tim Zhang, Daniel Kim, …); they are demo/preview data
  only. Their `paid` grant and "always bookable" are not business rules. Note:
  `migrations/0002_bookme.sql` still inserts them — would seed production on first migrate
  (deferred, issues-baselines.md).
- `zhouxiyin1024@gmail.com` is the founder super-admin (`ADMIN_EMAIL`) but has **no account in
  production yet**; don't assume one exists. Email/password sign-up has no verification, so
  the address can be claimed by anyone first (deferred, issues-baselines.md).
- `staff` table: protection list only (cannot be banned). Not a staff login.
- v1 admin cannot read message bodies.
- Whether production holds real clients/lessons is for the owner to confirm; always back up
  before deploying a migration.

## Payments and refunds (policy confirmed, not implemented)

- Student cancels: refund the lesson fee; the platform's collected 5% is not refunded.
- Coach cancels or lesson not delivered: full refund to the student; platform bears its fee.
- Use Stripe refund + Connect reversal; no separate ledger.
- Imported lessons (settled / outside_platform / not_tracked) never trigger Stripe refunds.
- Current code refunds without reversal (platform eats refunds) — deferred, issues-baselines.md.
