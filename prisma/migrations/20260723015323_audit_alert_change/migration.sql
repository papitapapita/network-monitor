-- DropIndex
DROP INDEX "wireless_alert_records_device_id_metric_is_active_idx";

-- CreateIndex
CREATE INDEX "wireless_alert_records_device_id_metric_severity_is_active_idx" ON "wireless_alert_records"("device_id", "metric", "severity", "is_active");
