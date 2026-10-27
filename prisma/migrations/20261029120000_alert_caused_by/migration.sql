-- A device that went down because its upstream did is attached to the
-- upstream's alert instead of paging on its own (NOT-241).
ALTER TABLE "alert_events" ADD COLUMN "caused_by_alert_id" UUID;

ALTER TABLE "alert_events"
  ADD CONSTRAINT "alert_events_caused_by_alert_id_fkey"
  FOREIGN KEY ("caused_by_alert_id") REFERENCES "alert_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "alert_events_caused_by_alert_id_idx"
  ON "alert_events"("caused_by_alert_id");
