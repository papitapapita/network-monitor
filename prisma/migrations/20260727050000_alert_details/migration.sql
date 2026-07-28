-- AlterTable: per-producer detail bag on alert_events
ALTER TABLE "alert_events"
  ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}';
