-- CreateTable
-- Per-device notification settings: an optional quiet-hours window (both
-- start and end, or neither — a device with neither always notifies) and an
-- optional override of the system-wide down-alert delay.
CREATE TABLE "device_notification_policies" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "alert_delay_minutes" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_notification_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_notification_policies_device_id_key" ON "device_notification_policies"("device_id");

-- AddForeignKey
ALTER TABLE "device_notification_policies" ADD CONSTRAINT "device_notification_policies_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint: reconstitute() bypasses domain validation for rows
-- written outside it, same reasoning as migration 20260722010000.
ALTER TABLE "device_notification_policies"
ADD CONSTRAINT "device_notification_policies_quiet_hours_both_or_neither"
CHECK (("quiet_hours_start" IS NULL) = ("quiet_hours_end" IS NULL));

ALTER TABLE "device_notification_policies"
ADD CONSTRAINT "device_notification_policies_alert_delay_minutes_non_negative"
CHECK ("alert_delay_minutes" IS NULL OR "alert_delay_minutes" >= 0);
