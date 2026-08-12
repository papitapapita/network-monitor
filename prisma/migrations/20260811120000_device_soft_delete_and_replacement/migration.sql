-- Device activation workflow: soft-delete with a grace period, replacement
-- lineage, and the DECOMMISSIONED status.

-- ---------------------------------------------------------------------------
-- 1. DECOMMISSIONED rejoins device_status.
--
-- It existed until 20260509000000_refine_device_status_and_category, which
-- dropped it and mapped its rows to DAMAGED. That conflated "obsolete but
-- working" with "broken", which the replacement flow now has to tell apart:
-- an antenna upgrade retires a unit that still functions.
--
-- ADD VALUE (as 20260612010529 used for COMMISSIONING) rather than the type
-- rewrite 20260509000000 needed — nothing is being removed, so no row has to
-- be remapped first.
-- ---------------------------------------------------------------------------
ALTER TYPE "device_status" ADD VALUE IF NOT EXISTS 'DECOMMISSIONED';

-- ---------------------------------------------------------------------------
-- 2. Soft-delete columns.
-- ---------------------------------------------------------------------------
ALTER TABLE "devices" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "devices" ADD COLUMN "deleted_by" UUID;

CREATE INDEX "devices_deleted_at_idx" ON "devices"("deleted_at");

-- ---------------------------------------------------------------------------
-- 3. Replacement lineage.
--
-- One stored column. `replaces_device_id` is UNIQUE, so the reverse direction
-- ("what replaced this unit") is the back-reference and cannot disagree with
-- it. ON DELETE SET NULL so purging a retired unit at the end of its grace
-- period breaks the chain rather than the delete.
-- ---------------------------------------------------------------------------
ALTER TABLE "devices" ADD COLUMN "replaced_at" TIMESTAMPTZ;
ALTER TABLE "devices" ADD COLUMN "replaces_device_id" UUID;

CREATE UNIQUE INDEX "devices_replaces_device_id_key" ON "devices"("replaces_device_id");

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_replaces_device_id_fkey"
  FOREIGN KEY ("replaces_device_id") REFERENCES "devices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. MAC and IP uniqueness becomes partial.
--
-- 20260730120000_unique_device_mac_and_ip made these plain unique indexes.
-- With soft-delete a tombstoned row would hold its address forever, so the
-- replacement could never take the IP the old unit released. Scoping the
-- index to live rows frees the address on delete while still refusing two
-- live devices on one address.
--
-- Names are kept identical: PrismaDeviceRepository.save() reads the
-- constraint name out of the P2002 message to decide which field to blame.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "devices_mac_address_key";
DROP INDEX IF EXISTS "devices_ip_address_key";

CREATE UNIQUE INDEX "devices_mac_address_key"
  ON "devices"("mac_address") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "devices_ip_address_key"
  ON "devices"("ip_address") WHERE "deleted_at" IS NULL;
