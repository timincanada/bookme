# BookMe

Coach booking, payments, student CRM, and a live voice assistant.

Stack: TanStack Start (Vite) · React 19 · Tailwind v4 · Better Auth · Postgres (Neon or PGLite) · Stripe · Grok voice.

## Run

```bash
npm ci
npm run dev
```

Without `DATABASE_URL` the app uses embedded PGLite (fine for a local demo). Production needs Neon.

```bash
npm run build
```

Vercel: Nitro preset is already in `vite.config.ts`. Build command `npm run build`. Output is the Nitro/Vercel bundle.

## Environment

Copy `.env.example` and fill in production values.

Required in production:

| Key | Why |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `BETTER_AUTH_SECRET` | Auth sessions |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://your-domain` |
| `BOOKME_APP_URL` | Same public origin (emails, magic links, Stripe return) |
| `VITE_AUTH_ENABLED` | `true` |

Optional:

| Key | Why |
|---|---|
| `STRIPE_SECRET_KEY` | Card checkout |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` |
| `RESEND_API_KEY` | Student / coach email |
| `MAIL_FROM` | Default `BookMe <noreply@bookme.training>` |
| `XAI_API_KEY` | Live assistant (Grok voice + chat) |
| `ASSISTANT_PROVIDER` | `grok` (default when XAI key is set) or `local` |
| `GOOGLE_MAPS_API_KEY` | Address autocomplete |
| `CRON_SECRET` | Protect `/api/cron/reminders` |

Stripe webhook path: `/api/stripe/webhook`  
Reminder cron path: `/api/cron/reminders`

## Demo

Sign in as `coach@bookme.test` after setup, or complete `/start` for a new coach.

Booking links are short: `/{slug}` and `/c/{slug}`.
