-- CreateTable
CREATE TABLE "vendor_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "vendor_telegram_chat_id" VARCHAR(64),
    "subscription_paid_until" DATE,
    "subscription_grace_days" INTEGER NOT NULL,
    "subscription_read_only_days" INTEGER NOT NULL,
    "ping_result_retention_days" INTEGER NOT NULL,
    "alert_retention_days" INTEGER NOT NULL,
    "wireless_snapshot_retention_days" INTEGER NOT NULL,
    "wireless_alert_record_retention_days" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vendor_settings_pkey" PRIMARY KEY ("id"),
    -- A single row: the install has one set of settings.
    CONSTRAINT "vendor_settings_single_row" CHECK ("id" = 1)
);
