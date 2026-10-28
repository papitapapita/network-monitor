-- CreateEnum
CREATE TYPE "discovery_source" AS ENUM ('SCAN', 'AP_STATION');

-- CreateTable
CREATE TABLE "discovered_devices" (
    "id" UUID NOT NULL,
    "mac_address" VARCHAR(17) NOT NULL,
    "ip_address" VARCHAR(45),
    "manufacturer" VARCHAR(150),
    "source" "discovery_source" NOT NULL,
    "segment" VARCHAR(18),
    "first_seen_at" TIMESTAMPTZ NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL,
    "ignored_at" TIMESTAMPTZ,

    CONSTRAINT "discovered_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discovered_devices_mac_address_key" ON "discovered_devices"("mac_address");

-- CreateIndex
CREATE INDEX "discovered_devices_last_seen_at_idx" ON "discovered_devices"("last_seen_at");
