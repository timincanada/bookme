# BookMe — deferred issues and verification baselines

## Known pre-existing issues (deferred — don't fix unless asked)

- `0002_bookme.sql` seeds demo coaches into any database it runs on.
- Admin email claimable via unverified email/password sign-up.
- `requestManage` returns code/token when Resend isn't configured (addressed by 0008).
- 6-digit code has no attempt limit; student sessionId in localStorage (addressed by 0008).
- Demo account creatable in production (`ensureDemoCoach`, password in `demo.ts`).
- `CRON_SECRET` unset → cron endpoints public; Places endpoints unauthenticated.
- Server-function validators are identity functions (no runtime validation).
- Refunds lack Connect reversal; student <24h cancel sets `no_refund` regardless of payment;
  "not delivered" status doesn't exist.
- Stripe Checkout `expires_at` vs 15-minute hold (Stripe minimum likely 30 min) — verify.
- `coachNextWeek` (normal lessons) doesn't create a payment row.
- Cancelling a normal lesson doesn't close its pending requests.
- `api.ts` is ~3k lines; two data layers (zustand/localStorage prototype vs DB); unused
  modules (`multiplayer`, `app-data`, `map-card`, `workspace`).
- Grok items in product.md.

## Verification baselines (after 0007)

- `tsc --noEmit`: 0 errors.
- `src/lib/bookme/*.test.ts`: 29 files; only `subscription.test.ts` fails (stale capability
  list — do not fix unless asked).
- Auth/app-data tests: 55/55. Grok template script tests: 178/195 (17 known failures).
- `eslint src`: 10 problems (2 errors in `lib/app-data/client.server.ts` and
  `lib/bookme/assistant-name.ts`, 8 warnings) — pre-existing; a batch must not add findings.
- Real Postgres 16: 0006 and 0007 apply via `migrate.mjs`; concurrency harness shows 0
  overlaps with the lock and overlaps without it (control).
