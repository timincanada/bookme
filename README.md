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
- Coach schedule: `/app/schedule`

## V1 notes

- Cash bookings confirm immediately as unpaid / pay in person.
- Card checkout uses Stripe Checkout (CAD). The slot is held 15 minutes until payment completes.
- Reschedule is free until 24 hours before the lesson.
- Seed coach: Tim Zhang, `tim-zhang`, CA$80 / 60 min, America/Toronto.

Card checkout needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Webhook: /api/stripe/webhook. Connect application_fee_amount=0.
