-- AlterEnum
ALTER TYPE "backup_format" ADD VALUE 'ROUTEROS_EXPORT';

-- AlterTable
ALTER TABLE "device_credentials" ADD COLUMN "ssh_port" INTEGER NOT NULL DEFAULT 22;
