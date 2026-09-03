-- AlterTable: down_since tracks when the current DOWN streak began, so the
-- delayed down-alert scan can tell a brief blip from a sustained outage
-- without waiting on that device's own poll interval.
ALTER TABLE "device_states"
  ADD COLUMN "down_since" TIMESTAMPTZ;

-- Backfill: a device already DOWN when this deploys has no observed start of
-- its current streak. Starting the clock at deploy time is a fail-safe
-- default — the worst case is one alert delayed by up to the threshold
-- again, never a burst of alerts for outages already in flight.
UPDATE "device_states"
  SET "down_since" = now()
  WHERE "status" = 'DOWN';

-- CreateIndex
CREATE INDEX "device_states_status_down_since_idx"
  ON "device_states"("status", "down_since");
