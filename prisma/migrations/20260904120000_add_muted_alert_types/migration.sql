-- CreateTable
-- Global, standing list of alert-type keys whose outbound notification is
-- suppressed for every device — the alert record itself is unaffected
-- (NOT-174/NOT-19x). Not per-device: see MutedAlertType in
-- domain/notifications/entities.
CREATE TABLE "muted_alert_types" (
    "id" UUID NOT NULL,
    "metric" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muted_alert_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "muted_alert_types_metric_key" ON "muted_alert_types"("metric");
