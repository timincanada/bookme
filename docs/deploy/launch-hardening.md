# Launch hardening (migrations 0009–0010)

Apply after 0006–0008 (see `production-0006-0008.md`). Back up first.

## Environment (Vercel → Production)

| Variable | Required | Notes |
|---|---|---|
| `CRON_SECRET` | **yes** | Cron endpoints now refuse every call when it is unset. Schedule `/api/cron/reminders` (daily or more) with `Authorization: Bearer <secret>` |
| `RESEND_API_KEY`, `MAIL_FROM` | **yes** | Coach sign-up now requires confirming the email; without mail nobody can finish signing up |
| `BETTER_AUTH_URL` | **yes** | Used in the email-confirmation link |
| `BOOKME_ALLOW_DEMO` | must be unset | The demo coach/students are created only outside production unless this is `1` |
| `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` | for the apps | See `docs/mobile/README.md` |
| `CSP_REPORT_ONLY` | optional | `1` sends the CSP as report-only (violations are only logged). Use for the first deploy, check the browser console, then remove it to enforce |
| `GROK_EXTENSIONS_ENABLED` | must be unset | The grok.com banner script is no longer injected unless this is `1` (it would violate the CSP) |

## What changed

- Demo coaches (Tim Zhang, Daniel Kim, …) are removed by 0010 unless a real account
  claimed them or they have clients/lessons/recurring schedules. Local/preview (PGLite)
  re-adds them from `migrations/dev/seed.sql`.
- Admin access requires the founder email **and** a verified address. Register
  `zhouxiyin1024@gmail.com` and confirm it via the emailed link right after deploying.
- Email/password: confirmation required before sign-in; minimum 10 characters;
  sign-in limited to 5 attempts per minute, sign-up/confirmation mails 5 per hour
  (stored in the `rateLimit` table, shared across instances).
- Refunds reverse the Connect transfer. Student cancellation: student gets the lesson
  fee back, platform keeps its 5% fee. Coach cancellation / lapsed hold: full refund,
  platform returns its fee.
- Stripe Checkout sessions expire after at least 31 minutes (Stripe minimum 30). The
  15-minute slot hold is unchanged; late payments are refunded by the webhook.
- Places autocomplete/details require a signed-in coach.
- Every server function checks its input at runtime (plain data, bounded sizes,
  no prototype keys).
- Response headers: HSTS, nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy,
  Permissions-Policy, and a Content-Security-Policy with a per-request nonce
  (`script-src 'self' 'nonce-…'`, no inline scripts otherwise; only production).
  The grok.com banner script is no longer injected. SAMEORIGIN / frame-ancestors
  also stop the site from loading inside the Grok preview iframe.

## Checks after deploy

```sql
select name from _migrations where name in ('0009_mobile_accounts.sql','0010_launch_hardening.sql'); -- 2 rows
select id, user_id from coaches where id like 'coach-%';  -- only claimed/used ones, normally none
select count(*) from "rateLimit";                         -- grows after sign-in attempts
```

- `curl -X POST https://bookme.training/api/cron/reminders` → 401 without the secret.
- `curl -I https://bookme.training/` shows `strict-transport-security` and
  `content-security-policy` (or `…-report-only` with `CSP_REPORT_ONLY=1`).
- Open the site and the coach app in Chrome/Safari with DevTools → Console: no
  "Refused to …" CSP messages on booking, checkout redirect, sign-in, messages,
  voice assistant. Then drop `CSP_REPORT_ONLY`.
- Sign up with a new email → confirmation email → link signs you in at `/app/setup`.
- Stripe test mode: card booking completes checkout; student self-cancel >24h refunds
  the lesson price and the connected account shows the reversed transfer.
