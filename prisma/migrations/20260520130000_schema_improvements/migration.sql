-- WirelessDeviceType enum replaces raw VARCHAR on wireless tables
CREATE TYPE "wireless_device_type" AS ENUM ('STATION', 'ACCESS_POINT');

ALTER TABLE "wireless_snapshots"
  ALTER COLUMN "device_type" TYPE "wireless_device_type"
  USING "device_type"::"wireless_device_type";

ALTER TABLE "wireless_polling_configurations"
  ALTER COLUMN "device_type" TYPE "wireless_device_type"
  USING "device_type"::"wireless_device_type";

-- Remove derived duration_secs column (value is always resolvedAt - startedAt)
ALTER TABLE "alert_events" DROP COLUMN IF EXISTS "duration_secs";

-- Indexes for common polling and dashboard queries
CREATE INDEX IF NOT EXISTS "devices_ip_address_idx" ON "devices"("ip_address");
CREATE INDEX IF NOT EXISTS "devices_monitoring_enabled_idx" ON "devices"("monitoring_enabled");

-- lastPolledAt tracks when the ping poller last ran for a device
ALTER TABLE "polling_configurations" ADD COLUMN IF NOT EXISTS "last_polled_at" TIMESTAMPTZ;
