-- CreateTable
CREATE TABLE "notification_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "telegram_chat_id" VARCHAR(64),
    "down_alert_delay_minutes" INTEGER NOT NULL,
    "wireless_alerts_enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id"),
    -- A single row: the install has one set of settings.
    CONSTRAINT "notification_settings_single_row" CHECK ("id" = 1)
);
