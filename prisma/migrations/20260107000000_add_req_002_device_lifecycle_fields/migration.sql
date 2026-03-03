-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- AlterTable - Add REQ-002 fields to NetworkDevice
ALTER TABLE "NetworkDevice" ADD COLUMN "activationStatus" "ActivationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "activatedAt" TIMESTAMP(3),
ADD COLUMN "activatedBy" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "replacedByDeviceId" TEXT,
ADD COLUMN "replacedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "location" VARCHAR(500),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex - Performance indexes for REQ-002 queries
CREATE INDEX "NetworkDevice_deletedAt_idx" ON "NetworkDevice"("deletedAt");

-- CreateIndex
CREATE INDEX "NetworkDevice_activationStatus_idx" ON "NetworkDevice"("activationStatus");

-- CreateIndex - Composite index for device replacement detection
CREATE INDEX "NetworkDevice_ipAddress_deletedAt_idx" ON "NetworkDevice"("ipAddress", "deletedAt");

-- CreateIndex - Composite index for MAC address replacement detection
CREATE INDEX "NetworkDevice_macAddress_deletedAt_idx" ON "NetworkDevice"("macAddress", "deletedAt");
