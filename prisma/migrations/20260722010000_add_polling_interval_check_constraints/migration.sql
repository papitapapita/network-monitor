-- Polling interval floors are enforced by the PollingInterval value objects, but
-- reconstitute() bypasses validation by design, so any row written outside the
-- domain (manual SQL, a bad backfill) would be loaded and polled as-is.
-- These CHECK constraints make the floors a database invariant.
--
-- Floors differ per bounded context:
--   device-monitoring   >= 5s   (orchestrator sweeps on a 1s tick)
--   wireless-monitoring >= 60s  (AirOS embedded web server cannot take more)

-- Clamp any pre-existing out-of-range rows, otherwise ADD CONSTRAINT fails.
UPDATE "polling_configurations"
SET "interval_seconds" = 5
WHERE "interval_seconds" < 5;

UPDATE "polling_configurations"
SET "interval_seconds" = 86400
WHERE "interval_seconds" > 86400;

UPDATE "wireless_polling_configurations"
SET "interval_secs" = 60
WHERE "interval_secs" < 60;

UPDATE "wireless_polling_configurations"
SET "interval_secs" = 86400
WHERE "interval_secs" > 86400;

-- AddCheckConstraint
ALTER TABLE "polling_configurations"
ADD CONSTRAINT "polling_configurations_interval_seconds_range"
CHECK ("interval_seconds" BETWEEN 5 AND 86400);

ALTER TABLE "wireless_polling_configurations"
ADD CONSTRAINT "wireless_polling_configurations_interval_secs_range"
CHECK ("interval_secs" BETWEEN 60 AND 86400);
