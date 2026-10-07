-- CreateEnum
CREATE TYPE "backup_format" AS ENUM ('AIROS_CFG');

-- CreateEnum
CREATE TYPE "backup_trigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "backup_outcome" AS ENUM ('SAVED', 'UNCHANGED', 'FAILED');

-- CreateTable
CREATE TABLE "config_backups" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "format" "backup_format" NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "trigger" "backup_trigger" NOT NULL,
    "encrypted_content" TEXT NOT NULL,
    "taken_at" TIMESTAMPTZ NOT NULL,
    "last_checked_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "config_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_backup_states" (
    "device_id" UUID NOT NULL,
    "last_attempt_at" TIMESTAMPTZ,
    "last_outcome" "backup_outcome",
    "last_error" VARCHAR(500),
    "last_success_at" TIMESTAMPTZ,
    "failing_since" TIMESTAMPTZ,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_backup_states_pkey" PRIMARY KEY ("device_id")
);

-- CreateIndex
CREATE INDEX "config_backups_device_id_taken_at_idx" ON "config_backups"("device_id", "taken_at" DESC);

-- AddForeignKey
ALTER TABLE "config_backups" ADD CONSTRAINT "config_backups_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_backup_states" ADD CONSTRAINT "device_backup_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
