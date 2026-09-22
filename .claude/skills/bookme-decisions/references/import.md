# BookMe — recurring import (0007, merged, scope closed)

## Recurring import (0007, merged — scope closed)

Tables: `recurring_series`, `recurring_slots`; `lessons.source`, `series_id`, `slot_id`,
`duration_min`; `clients.payment_status/payment_note/split_ratio`; `clients.email` nullable.
Code: `recurring.ts` (pure), `recurring-service.ts`, `recurring-api.ts`,
`routes/app/import.tsx`, `routes/app/series.$id.tsx`, `recurring-plan-card.tsx`.

| ID | Rule |
|---|---|
| R1 | A rule = set of weekday + wall-clock slots (several per week, max 14), repeated every week or every 2 weeks. Every-2-weeks: week 1 = the Monday-based week containing the start date; all slots share parity |
| R2 | End date inclusive, ≤ start + 6 calendar months (3/31 → 9/30), coach zone; start ≥ coach's today; no past imports |
| R3 | Creates `confirmed` lessons, `source = imported_recurring`; occupy public inventory; no double booking (advisory lock + same-transaction conflict check) |
| R4 | Conflicts (confirmed lesson, open hold, blocked day, past, DST gap) are skipped; card shows create/skip counts and each skipped date |
| R5 | Outside public hours allowed; card warns "still holds the slot". Coach may move an imported lesson outside hours after a confirm step |
| R6 | No Stripe; `payments.method = offline`, `status = not_tracked`, amount 0 |
| R7 | Client-level and series-level payment notes both kept and edited separately; a new series copies the client's values at that time. A client created by an import is initialized with the import's values |
| R8 | Single lesson may be "marked collected"; doesn't change the series |
| R9 | Students can't self-reschedule imported lessons; they can cancel (normal rules) and use `studentRequestMove` (coach approves) |
| R10 | Imported lessons are not swappable; no "book same time next week" |
| R11 | With email: 24h/2h reminders on. "Added to your schedule" and "schedule ended" emails default off, English |
| R12 | Imported lessons don't count toward subscription tiering |
| R13 | Entry points: coach form + assistant text confirm card (confirm button or typed「确认导入」/"confirm import"). Writes require the server-recomputed fingerprint; client-supplied actions only preview. No local-parser multi-slot parsing: without a model provider, reply with the form link |
| R14 | Only the current coach's client; no-email clients allowed with a warning (no portal/messages/reminders) |
| R15 | No series pause (use per-lesson cancel or end + re-import). Prerequisite: service + location + active trial/plan (same as normal bookings). Multiple active series per client allowed with a warning. "End schedule" cancels confirmed lessons from a chosen date (≥ today) and closes their pending requests |

Card/form copy English; the assistant recap follows the coach's language.
