-- DropIndex
DROP INDEX IF EXISTS "devices_ip_address_idx";

-- CreateIndex
CREATE UNIQUE INDEX "devices_mac_address_key" ON "devices"("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "devices_ip_address_key" ON "devices"("ip_address");
