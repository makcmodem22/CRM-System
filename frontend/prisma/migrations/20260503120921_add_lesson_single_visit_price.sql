-- Adds single_visit_price (UAH, integer) to public_lesson.
-- Existing rows backfill to 200 via the column default; no manual update needed.
-- Safe to run on Supabase via SQL Editor. Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "public_lesson"
  ADD COLUMN IF NOT EXISTS "single_visit_price" INTEGER NOT NULL DEFAULT 200;
