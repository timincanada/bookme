# BookMe — student portal, email-code login, messaging (0008)

## Student portal, email-code login, messages (0008 — rules locked)

| ID | Rule |
|---|---|
| P1 | Messaging eligibility: ≥1 `confirmed`/`completed` lesson with that coach (imports count); cancelled-only doesn't. Sending allowed until 90 days after the last valid lesson ends, then read-only; a new valid lesson extends it |
| P2 | Coaches may start conversations with eligible students; visitors without a booking can't contact coaches |
| P3 | Portal stays at `/manage`; existing email links keep working; aliases allowed, no main-path change |
| P4 | No 6th bottom tab; Messages lives under More with an unread badge, plus an envelope entry on the Schedule header; Assistant tab stays |
| P5 | New-message email: 10-minute cooldown, no body (only "new message" + link), skip if the recipient opened the thread during the cooldown |
| P6 | Case-insensitive email matching in queries; historical emails not rewritten; new writes lower-case |
| P7 | Student session 30 days; code valid 30 minutes; 5 wrong attempts invalidate it; max 5 codes per email per hour |
| P8 | Swap views (`/r/$token`, portal, manage) show "Another student" + time, never the other student's name |
| P9 | Banned or lapsed coach: existing conversations readable, no sending, no new conversations |
| P10 | v1 admin cannot read message bodies |
| P11 | Swap-request emails (`coachSwapRequestMail`) also say "another student" |
| P12 | Coach sending is limited by the same 90-day window (symmetric) |
| P13 | Banned/lapsed coach: neither side can send |
| P14 | Code requests also capped at 20 per IP per hour |
| P15 | 0008 invalidates in-flight codes and student sessions (one re-login) |
| P16 | Max 20 messages per sender per minute |
| P17 | Portal main path stays `/manage`; short link `/s` redirects there (query kept). Existing coach slugs are not changed |
| P18 | Cookie login may not work inside the Grok preview iframe — handled in the Grok batch |

Design: `students`; hashed codes/tokens with attempts on `manage_links`; hashed httpOnly-cookie
`student_sessions`; `conversations` (unique per coach+client) and `messages` (text 1–2000);
`/manage` layout with lessons index, `messages`, `messages/$coachId`; coach `/app/messages`
and `$clientId`; polling with an `after` cursor; codes are never returned to the client except
with an explicit dev flag.
