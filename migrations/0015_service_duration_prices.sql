-- 0015 — Per-duration prices.
-- Map of minutes (string keys) to integer CAD, e.g. {"30":60,"60":85}.
-- Null or a missing key falls back to price_cad. Writers keep price_cad
-- equal to the shortest enabled duration so older readers still see a price.

alter table services
  add column if not exists duration_prices jsonb;
