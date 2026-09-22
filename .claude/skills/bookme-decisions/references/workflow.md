# BookMe — how a batch runs

## Steps

1. **Scope.** Restate the batch in a few lines, citing rule IDs (R…, P…) instead of
   repeating them. If the request would mix batches (e.g. Grok leftovers into a feature
   batch), say so and keep them apart.
2. **File list first, no code.** Tables/columns, routes, pages, server functions, files to
   change, how it connects to existing flows, then numbered open questions. Locked rules go in
   one table at the top so nothing is re-asked. Wait for confirmation.
3. **Implement only what the batch needs.** Name every extra file you had to touch and why.
   Leave unrelated bugs alone; list them (see issues-baselines.md).
4. **Verify, with numbers.**
   - `npx tsc --noEmit` → 0 errors.
   - Run each `src/lib/bookme/*.test.ts` on its own:
     `cd src/lib/bookme && node ../../../node_modules/tsx/dist/cli.mjs <file>`
     (the bundled runner stops at the first failure).
   - `npx eslint src`, compared with the pre-batch baseline — no new findings.
   - Database work: PGLite tests over the real `migrations/*.sql`, plus real PostgreSQL via
     `scripts/migrate.mjs` for upgrades, rollbacks and concurrency (include a no-lock control
     that must fail).
   - New rules: break each one on purpose (mutation check) and confirm a test fails.
   - Route or bundling changes: `vite build` (regenerates `src/routeTree.gen.ts`), delete
     `.vercel/` and `.tanstack/` afterwards, confirm server-only code is absent from client assets.
5. **Deliver only the diff**: a patch against the last merged state that reproduces the
   working tree, the changed files, and a short report (verification counts, rule mapping,
   trade-offs, what's not done).
6. **After the owner confirms**, update the relevant reference file: batch status
   (product.md), new rules and answered questions (topic file), deferred issues and baselines
   (issues-baselines.md). Keep IDs stable.

Short verification requests ("reply in two sentences") get two sentences backed by a quick
check of the merged code.

## Guardrails

- No framework, UI library or brand changes (brand in product.md).
- Security, payments, auth: point out problems; change only when the batch is about them.
- No hard-coded time zone in time logic; `time.ts` requires the zone (isolation.md).
- CRM is per coach; students never see coach notes, payment notes or other students' names.
- Schedule writes that check for a free time take `lockCoachSchedule` inside
  `withTransaction` (`src/lib/db.ts`).
- Don't invent files, tables or APIs outside the repo or an agreed list.
- Don't fix known pre-existing failures unless asked.
- Closed scope stays closed: no series pause, no complex RRULE, no Grok voice work.

## Environment notes

- Sandbox shell is `/bin/sh`: no `<(...)`, no `{a,b}` expansion; use temp files or Python.
- `apt-get` may 403 on the nodesource source; install Postgres with only the Ubuntu sources
  list; run it on a side port (e.g. 5433) with a socket dir under `/tmp`.
- Tests import siblings with `.ts` extensions. `src/lib/db.ts` uses `import.meta.glob`, so tests
  wrap PGLite or `pg` in a `{ query }` object and apply migration files directly.

## Communication

Answer in Chinese; keep identifiers as-is. App UI and emails stay English; assistant recaps
follow the coach's language. Number open questions.
