-- DEV-180: one upstream link per device, replacing the STATION-only
-- parent AP that lived on the wireless polling config (WLS-162).
ALTER TABLE "devices" ADD COLUMN "upstream_device_id" UUID;

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_upstream_device_id_fkey"
  FOREIGN KEY ("upstream_device_id") REFERENCES "devices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "devices_upstream_device_id_idx" ON "devices"("upstream_device_id");

-- Every declared parent AP becomes the station's upstream. The old column
-- could not point at itself (WLS-162), so no row here can form a cycle.
UPDATE "devices" d
SET "upstream_device_id" = w."parent_ap_device_id"
FROM "wireless_polling_configurations" w
WHERE w."device_id" = d."id"
  AND w."parent_ap_device_id" IS NOT NULL
  AND w."parent_ap_device_id" <> d."id";

DROP INDEX IF EXISTS "wireless_polling_configurations_parent_ap_device_id_idx";
ALTER TABLE "wireless_polling_configurations"
  DROP CONSTRAINT IF EXISTS "wireless_polling_configurations_parent_ap_device_id_fkey";
ALTER TABLE "wireless_polling_configurations" DROP COLUMN "parent_ap_device_id";
