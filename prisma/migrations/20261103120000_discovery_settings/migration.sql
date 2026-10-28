-- CreateTable
CREATE TABLE "discovery_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL,
    "interval_hours" SMALLINT NOT NULL,
    "segments" JSONB NOT NULL,
    "last_run_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "discovery_settings_pkey" PRIMARY KEY ("id")
);
