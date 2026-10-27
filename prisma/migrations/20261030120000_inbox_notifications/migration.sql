-- Each user's in-app notification inbox (NOT-260). One row per recipient so
-- read state is per user; a retried delivery hits the unique dedup key.
CREATE TABLE "inbox_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "type" VARCHAR(100) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "device_id" UUID,
    "alert_id" UUID,
    "dedup_key" VARCHAR(255) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inbox_notifications_user_id_created_at_idx" ON "inbox_notifications"("user_id", "created_at" DESC);

CREATE INDEX "inbox_notifications_user_id_read_at_idx" ON "inbox_notifications"("user_id", "read_at");

CREATE INDEX "inbox_notifications_created_at_idx" ON "inbox_notifications"("created_at");

CREATE INDEX "inbox_notifications_device_id_idx" ON "inbox_notifications"("device_id");

CREATE INDEX "inbox_notifications_alert_id_idx" ON "inbox_notifications"("alert_id");

CREATE UNIQUE INDEX "inbox_notifications_user_id_dedup_key_key" ON "inbox_notifications"("user_id", "dedup_key");

ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alert_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
