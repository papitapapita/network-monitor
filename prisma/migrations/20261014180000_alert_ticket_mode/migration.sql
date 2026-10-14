-- CreateEnum
CREATE TYPE "alert_ticket_mode" AS ENUM ('SUGGEST', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN "alert_ticket_mode" "alert_ticket_mode" NOT NULL DEFAULT 'SUGGEST';
