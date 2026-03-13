-- AlterTable
ALTER TABLE "polling_configurations" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ip_address" VARCHAR(45);

-- CreateIndex
CREATE INDEX "polling_configurations_enabled_idx" ON "polling_configurations"("enabled");
