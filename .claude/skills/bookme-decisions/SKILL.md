---
name: bookme-decisions
description: BookMe product decisions and batch discipline — client isolation (per-coach CRM), recurring schedule import, time zones, student portal / email-code login, messaging, refunds policy, Grok leftovers. Use for any work in the BookMe repo (coach booking + payments + CRM on TanStack Start, Postgres, Stripe, Vercel) — reviews, batch checklists, migrations, features, or "what did we decide about X" — even when only one file or feature is mentioned.
---

# BookMe decisions

Rules here were settled batch by batch with the owner. Cite them; don't re-derive or restate them.

## Discipline

1. **File list before code.** For any new batch, first deliver the list of tables, routes,
   pages, APIs and files to change, plus numbered open questions. Write code only after the
   owner confirms.
2. **Deliver only the diff.** A patch against the last merged state plus the changed files and a
   short verification report. No full-file dumps in chat, no repo tour.
3. **Don't restate confirmed rules.** Refer to them by ID (R1–R15, P1–P10) or file. Don't
   re-summarize the repository or re-ask answered questions.
4. **One batch at a time.** Only touch files the batch needs; list unrelated problems instead of
   fixing them. Grok leftovers are their own batch.

## References — read only the one you need

| Need | File |
|---|---|
| Step-by-step batch workflow, verification commands, guardrails, sandbox quirks | `references/workflow.md` |
| Product scope, brand, platform, batch status, production facts, refund policy | `references/product.md` |
| Per-coach clients, 0006 ownership/backfill/rollback, time-zone rules | `references/isolation.md` |
| Recurring import rules R1–R15 (0007, scope closed) | `references/import.md` |
| Student portal, email-code login, messaging P1–P10 and open questions (0008) | `references/portal-messaging.md` |
| Deferred pre-existing issues, test/lint baselines | `references/issues-baselines.md` |

After the owner confirms a batch or answers questions, update the matching reference file.
