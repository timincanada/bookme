# BookMe

Mobile-first web app for independent coaches: private-lesson booking, cash or card, client records, in-app reschedule by email.

## Run

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Open http://localhost:3000

- Student booking: `/tim-zhang` then Book a lesson. Choose **Cash** to confirm without Stripe.
- Find / reschedule: `/manage` — enter the booking email, then open the one-time link or 6-digit code. No student account. Self-serve until 24 hours before the lesson.
- Coach open for business: `/app/register` then `/app/setup` (basics, locations, weekly hours). Copy the booking link only after a trial.
- Coach sign in: `/app/login` (seed: `tim@bookme.test` / `coach123`)
- Coach schedule: `/app/schedule`

## V1 notes

- Cash bookings confirm immediately as unpaid / pay in person.
- Card checkout uses Stripe Checkout (CAD). The slot is held 15 minutes until payment completes.
- Reschedule is free until 24 hours before the lesson.
- Seed coach: Tim Zhang, `tim-zhang`, CA$80 / 60 min, America/Toronto.
- Coach plans: Light CA$19 (e20 confirmed/mo), Coach CA$29 (21-60), Busy CA$49 (61+). 3-day Light trial (card required), then auto-renew. Next cycle moves up or down from last month confirmed count. Unsubscribed coaches cannot take new bookings; existing lessons can still be moved, cancelled, or marked collected.


Card checkout needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Webhook: /api/stripe/webhook. Connect application_fee_amount=0.

- Confirmation emails go to coach and student on cash confirm and card paid. Without RESEND_API_KEY they stub to the server log.

- Coach lesson detail `/app/lessons/[id]`: reschedule, cancel (card always refunds), book same time next week.

- More: edit weekly hours, locations, and accepted payments (card / cash / both; at least one on). Checkout only shows enabled methods.

- Student booking: if the coach has 2+ locations, pick one (S3). A single location is attached automatically. Never defaults to the first of many.

- Confirmed lessons send a 24h and 2h reminder to coach and student. Without RESEND_API_KEY they stub to `[mail stub]` in the log. Cron: `/api/cron/reminders` hourly.

- Student manage is a one-time email link or 6-digit code. Without RESEND_API_KEY the send logs `[mail stub]` including the link.


## Deploy (Vercel)

Production uses Postgres. Vercel filesystem cannot keep SQLite.

1. Create a Postgres database (`npx create-db@latest` or Neon) and claim it so it is not deleted.
2. Put the DB URL and generated app secrets in the host env only. Never commit them.
3. Leave Stripe and Resend empty: cash booking works, mail logs `[mail stub]`.
4. Build runs `prisma migrate deploy` then `next build`. Seed once with `npm run seed`.

Seed coach: `tim@bookme.test` / `coach123`, booking link `/tim-zhang`.
