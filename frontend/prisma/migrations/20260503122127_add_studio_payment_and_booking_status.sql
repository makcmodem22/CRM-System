-- Phase 1: payment foundation.
-- 1) Adds a status column to public_lesson_booking. Existing rows are CONFIRMED.
--    PENDING_PAYMENT bookings still hold the slot (count toward booked_count); a sweeper deletes them after the TTL.
-- 2) Creates studio_payment to track LiqPay charges/refunds for both single-visit bookings and plan purchases.
-- Safe to run on Supabase via SQL Editor. Idempotent guards used where possible.

ALTER TABLE "public_lesson_booking"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'CONFIRMED';

CREATE INDEX IF NOT EXISTS "public_lesson_booking_status_created_at_idx"
  ON "public_lesson_booking" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "studio_payment" (
  "id"                TEXT PRIMARY KEY,
  "liqpay_order_id"   TEXT NOT NULL,
  "liqpay_payment_id" TEXT,
  "amount"            INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'UAH',
  "status"            TEXT NOT NULL DEFAULT 'CREATED',
  "purpose"           TEXT NOT NULL,
  "booking_id"        TEXT,
  "client_user_id"    TEXT,
  "client_email"      TEXT NOT NULL,
  "plan_id"           TEXT,
  "plan_snapshot"     JSONB,
  "meta"              JSONB,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  "paid_at"           TIMESTAMP(3),
  "refunded_at"       TIMESTAMP(3),
  CONSTRAINT "studio_payment_liqpay_order_id_key" UNIQUE ("liqpay_order_id"),
  CONSTRAINT "studio_payment_booking_id_fkey"
    FOREIGN KEY ("booking_id")
    REFERENCES "public_lesson_booking"("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "studio_payment_client_email_idx"  ON "studio_payment" ("client_email");
CREATE INDEX IF NOT EXISTS "studio_payment_booking_id_idx"    ON "studio_payment" ("booking_id");
CREATE INDEX IF NOT EXISTS "studio_payment_status_idx"        ON "studio_payment" ("status");
