-- Add accepts_certificates column to public_lesson.
-- Default true backfills every existing row, so all trainings keep
-- accepting certificates exactly as they did before this change.
ALTER TABLE "public_lesson"
  ADD COLUMN "accepts_certificates" BOOLEAN NOT NULL DEFAULT true;
