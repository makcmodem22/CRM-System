-- Bump default single-visit price 200 UAH -> 300 UAH.
-- The studio's standard price is 300; lessons left at the old default were charging
-- 200 at the LiqPay checkout while the booking UI showed 300. This fixes both halves:
--   (1) future lessons get the right default
--   (2) one-shot update for lessons still at the old default. Lessons with any other
--       custom price (e.g. promo lesson at 250, premium at 400) are left untouched.

ALTER TABLE "public_lesson" ALTER COLUMN "single_visit_price" SET DEFAULT 300;

UPDATE "public_lesson"
   SET "single_visit_price" = 300
 WHERE "single_visit_price" = 200;
