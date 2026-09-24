# Deploy BookMe to Vercel

Everything an agent needs to put this repository live at `https://bookme.training`.
Read this file first. Details: `docs/deploy/production-0006-0008.md` (migrations
0006–0008), `docs/deploy/launch-hardening.md` (0009–0010), `docs/mobile/README.md`
(iOS/Android apps — not part of a web deploy).

Stack: TanStack Start (Vite + Nitro, Vercel preset), Postgres (Neon), Better Auth,
Stripe, Resend. Node 22.

## 0. Rules for whoever runs this

- Do not change the product, brand, framework or schema to make a deploy work.
  If something fails, report the failure instead of redesigning.
- Migrations are the only schema source and run automatically during the build.
  Never edit an applied migration file; add a new one.
- Back up the database before the first deploy with these migrations.
- The project's locked decisions live in `.claude/skills/bookme-decisions/`.

## 1. Prerequisites

1. **Neon Postgres** database; copy its pooled connection string.
2. **Resend** account, a verified sending domain, an API key.
3. **Stripe** account (live or test): secret key, three subscription price IDs,
   and — after step 4 — a webhook signing secret.
4. **Vercel** project connected to this repository (framework preset: Other;
   build command `npm run build`; install `npm ci`; Node 22).
5. Domain `bookme.training` (and `www`) pointed at the Vercel project.

## 2. Environment variables (Vercel → Settings → Environment Variables → Production)

Required — the site is broken without these:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (pooled) |
| `BETTER_AUTH_SECRET` | 32+ random characters (`openssl rand -base64 32`). Also keys student login codes/sessions — changing it later signs everyone out |
| `BETTER_AUTH_URL` | `https://bookme.training` |
| `BOOKME_APP_URL` | `https://bookme.training` |
| `VITE_AUTH_ENABLED` | `true` |
| `RESEND_API_KEY` | Resend API key — without it coaches cannot confirm sign-up and students cannot sign in |
| `MAIL_FROM` | e.g. `BookMe <hello@bookme.training>` (verified domain) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | From step 4 |
| `STRIPE_PRICE_LIGHT` / `STRIPE_PRICE_COACH` / `STRIPE_PRICE_BUSY` | Subscription price IDs |
| `CRON_SECRET` | Random string. Cron endpoints reject every call when unset |

Recommended:

| Variable | Value |
|---|---|
| `CSP_REPORT_ONLY` | `1` for the first deploy (see step 6), then delete |
| `XAI_API_KEY` | Assistant (text/voice). Without it the assistant falls back to a simple parser |
| `GOOGLE_MAPS_API_KEY` | Address autocomplete when adding locations |
| `APPLE_TEAM_ID` | 10 characters; makes `/.well-known/apple-app-site-association` serve (iOS deep links) |
| `ANDROID_CERT_SHA256` | Play app-signing SHA-256 (`AA:BB:…`); makes `/.well-known/assetlinks.json` serve |

Must stay unset in production: `BOOKME_ALLOW_DEMO`, `BOOKME_DEV_SHOW_CODE`,
`GROK_EXTENSIONS_ENABLED`.

## 3. First deploy

1. Back up the database (Neon branch or `pg_dump`).
2. Deploy. The build runs `vite build` and then `scripts/migrate.mjs`, which applies
   `migrations/0001…0010` in order. The log must show `applied 0010_launch_hardening.sql`
   (or `up to date`).
3. If the build fails on migrations, stop and report the SQL error — do not edit
   migration files.

## 4. Stripe webhook

Add an endpoint in the Stripe dashboard: `https://bookme.training/api/stripe/webhook`,
events `checkout.session.completed`, `checkout.session.expired`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.created` (the events the handler in
`src/lib/bookme/stripe-webhook.ts` acts on). Put its signing secret in `STRIPE_WEBHOOK_SECRET` and
redeploy. Also enable Stripe Connect Express (coaches connect their own payouts).

## 5. Cron

Schedule `https://bookme.training/api/cron/reminders` at least daily (hourly is
better) with header `Authorization: Bearer <CRON_SECRET>`. It sends 24h/2h lesson
reminders and purges coach accounts 30 days after deletion. A Vercel cron job plus
`CRON_SECRET` works; without the header the endpoint returns 401.

## 6. After deploying — checks

```bash
curl -I https://bookme.training/                      # 200 + strict-transport-security + content-security-policy
curl -X POST https://bookme.training/api/cron/reminders # 401 without the secret
curl https://bookme.training/.well-known/assetlinks.json # JSON once ANDROID_CERT_SHA256 is set
```

```sql
select name from _migrations order by name;   -- 0001 … 0010
select count(*) from coaches;                 -- 0 on a fresh database (no demo coaches)
```

Then, in a browser with DevTools open (Console must stay free of "Refused to…"
CSP messages):

1. Sign up as a coach → confirmation email arrives → the link signs you in at `/app/setup`.
2. Finish setup, start the trial, copy the booking link, book a lesson as a student
   (cash and card; card needs Stripe test mode).
3. `/manage`: request a code, sign in, cancel a lesson, send a message to the coach.
4. Remove `CSP_REPORT_ONLY` and redeploy once the console is clean.

## 7. Right after go-live

- Register `zhouxiyin1024@gmail.com` and confirm the email — admin access needs that
  address **and** a verified email, so claim it before anyone else can.
- Check `https://bookme.training/<a coach slug>` renders and that the booking page
  shows open times in the coach's time zone.

## 8. Known, deliberate

- `npm test` fails: one stale test (`subscription.test.ts`) and 21 tests belonging to
  the Grok app-builder template. Neither affects the build or the product. Do not
  "fix" them by changing product code.
- Google/X sign-in goes through a Grok broker and will not work on Vercel. Email +
  password is the supported coach sign-in; students use email codes.
- No Content-Security-Policy in development (Vite injects inline scripts); production only.

## 9. Preview deployments

PR previews run with `NODE_ENV=production` and `VERCEL_ENV=preview`. `BETTER_AUTH_URL` may stay `https://bookme.training`.

- Browser sign-up trusts `https://$VERCEL_URL`, `https://$VERCEL_BRANCH_URL`, and `*.vercel.app` on preview. Production trusts `bookme.training` plus that deployment's own Vercel host.
- The demo coach (`coach@bookme.test`, public page `/alex`, Mayfair Parkway with coordinates) is seeded on preview. Leave `BOOKME_ALLOW_DEMO` unset on Production.
- Extreme weather on a preview: set `BOOKME_OPEN_METEO_FIXTURE` to an absolute path of raw Open-Meteo JSON. Every forecast lookup returns that body. See the header of `src/lib/bookme/weather-service.ts`. Optional.
