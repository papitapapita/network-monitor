-- CreateEnum
CREATE TYPE "quiet_hours_mode" AS ENUM ('INHERIT', 'CUSTOM', 'ALWAYS_NOTIFY');

-- AlterTable
ALTER TABLE "device_notification_policies" ADD COLUMN "quiet_hours_mode" "quiet_hours_mode" NOT NULL DEFAULT 'INHERIT';

-- A device that carried its own window keeps it. One without a window used to
-- always notify; it now follows the install's quiet hours, and with none set
-- yet (the columns below start empty) it behaves exactly as before.
UPDATE "device_notification_policies"
SET "quiet_hours_mode" = 'CUSTOM'
WHERE "quiet_hours_start" IS NOT NULL;

ALTER TABLE "device_notification_policies"
ADD CONSTRAINT "device_notification_policies_quiet_hours_only_when_custom"
CHECK (("quiet_hours_mode" = 'CUSTOM') = ("quiet_hours_start" IS NOT NULL));

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN "quiet_hours_start" VARCHAR(5),
ADD COLUMN "quiet_hours_end" VARCHAR(5);

ALTER TABLE "notification_settings"
ADD CONSTRAINT "notification_settings_quiet_hours_both_or_neither"
CHECK (("quiet_hours_start" IS NULL) = ("quiet_hours_end" IS NULL));
