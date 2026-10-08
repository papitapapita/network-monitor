-- CreateTable
CREATE TABLE "wireless_alert_thresholds" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "thresholds" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wireless_alert_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wireless_alert_threshold_overrides" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "overrides" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wireless_alert_threshold_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wireless_alert_threshold_overrides_device_id_key" ON "wireless_alert_threshold_overrides"("device_id");

-- AddForeignKey
ALTER TABLE "wireless_alert_threshold_overrides" ADD CONSTRAINT "wireless_alert_threshold_overrides_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
