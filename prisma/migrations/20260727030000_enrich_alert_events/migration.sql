-- AlterTable: enrich alert_events with origin/type/description
ALTER TABLE "alert_events"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "type" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

-- Backfill existing rows (all pre-existing alerts are device-availability alerts)
UPDATE "alert_events"
  SET "source" = 'Disponibilidad', "type" = 'device_unreachable'
  WHERE "type" = '';

-- CreateIndex: supports per-(device, type) open-alert dedup lookups
CREATE INDEX "alert_events_device_id_type_resolved_at_idx"
  ON "alert_events"("device_id", "type", "resolved_at");
