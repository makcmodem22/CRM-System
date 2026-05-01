-- CRM studio tables for Brave! Yoga (matches `frontend/prisma/schema.prisma` @@map models).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Uses `public` schema. Safe to re-run: `IF NOT EXISTS` on tables (indexes use IF NOT EXISTS).

-- ── public_lesson ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.public_lesson (
  id               TEXT NOT NULL,
  class_name       TEXT NOT NULL,
  trainer_name     TEXT NOT NULL,
  start_timestamp  TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,
  end_timestamp    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,
  capacity         INTEGER NOT NULL,
  booked_count     INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'SCHEDULED',
  CONSTRAINT public_lesson_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS public_lesson_start_timestamp_idx
  ON public.public_lesson (start_timestamp);

-- ── public_lesson_booking ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.public_lesson_booking (
  id              TEXT NOT NULL,
  lesson_id       TEXT NOT NULL,
  client_user_id  TEXT,
  client_email    TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  created_at      TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  meta            JSONB,
  CONSTRAINT public_lesson_booking_pkey PRIMARY KEY (id),
  CONSTRAINT public_lesson_booking_lesson_id_fkey
    FOREIGN KEY (lesson_id) REFERENCES public.public_lesson (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS public_lesson_booking_lesson_id_idx
  ON public.public_lesson_booking (lesson_id);

CREATE INDEX IF NOT EXISTS public_lesson_booking_client_email_idx
  ON public.public_lesson_booking (client_email);

-- ── studio_client ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.studio_client (
  id                   TEXT NOT NULL,
  email                TEXT NOT NULL,
  name                 TEXT NOT NULL,
  phone                TEXT NOT NULL DEFAULT '',
  subscriptions_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT studio_client_pkey PRIMARY KEY (id),
  CONSTRAINT studio_client_email_key UNIQUE (email)
);

-- ── studio_config (single row id = 1) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.studio_config (
  id                 INTEGER NOT NULL,
  trainers_json      JSONB NOT NULL,
  class_types_json   JSONB NOT NULL,
  plans_json         JSONB NOT NULL,
  promo_codes_json   JSONB NOT NULL,
  CONSTRAINT studio_config_pkey PRIMARY KEY (id)
);

-- The first app request creates the `studio_config` row (id = 1) with default trainers / plans via Prisma.
