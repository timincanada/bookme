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
- Find / reschedule: `/manage` with the email used at checkout.
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
