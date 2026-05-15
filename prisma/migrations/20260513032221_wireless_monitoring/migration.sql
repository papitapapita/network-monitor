-- CreateEnum
CREATE TYPE "wireless_alert_severity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "device_credentials" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "snmp_version" INTEGER NOT NULL DEFAULT 3,
    "snmp_community" VARCHAR(500),
    "snmp_v3_auth_user" VARCHAR(500),
    "snmp_v3_auth_proto" VARCHAR(20),
    "snmp_v3_auth_key" VARCHAR(500),
    "snmp_v3_priv_proto" VARCHAR(20),
    "snmp_v3_priv_key" VARCHAR(500),
    "http_username" VARCHAR(500),
    "http_password" VARCHAR(500),
    "snmp_port" INTEGER NOT NULL DEFAULT 161,
    "http_port" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wireless_snapshots" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "device_type" VARCHAR(20) NOT NULL,
    "collected_at" TIMESTAMPTZ NOT NULL,
    "collection_method" VARCHAR(20) NOT NULL,
    "signal_rx_dbm" INTEGER,
    "signal_tx_dbm" INTEGER,
    "noise_floor_dbm" INTEGER,
    "snr_db" INTEGER,
    "ccq_percent" INTEGER,
    "tx_rate_mbps" DECIMAL(10,2),
    "rx_rate_mbps" DECIMAL(10,2),
    "frequency_mhz" INTEGER,
    "channel_width_mhz" INTEGER,
    "tx_power_dbm" INTEGER,
    "throughput_tx_bps" BIGINT,
    "throughput_rx_bps" BIGINT,
    "throughput_tx_pps" BIGINT,
    "throughput_rx_pps" BIGINT,
    "lan_status" VARCHAR(10),
    "lan_speed_mbps" INTEGER,
    "lan_duplex" VARCHAR(10),
    "uptime_seconds" BIGINT,
    "cpu_load_percent" INTEGER,
    "memory_used_percent" INTEGER,
    "firmware_version" VARCHAR(100),
    "device_name" VARCHAR(150),
    "remote_ap_mac" VARCHAR(17),
    "remote_ap_name" VARCHAR(150),
    "distance_m" INTEGER,
    "latency_ms" INTEGER,
    "clients_connected" INTEGER,
    "clients_provisioned" INTEGER,
    "clients_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wireless_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wireless_alert_records" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "metric" VARCHAR(50) NOT NULL,
    "severity" "wireless_alert_severity" NOT NULL,
    "threshold" DECIMAL(12,4) NOT NULL,
    "triggered_at" TIMESTAMPTZ NOT NULL,
    "cleared_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_value" DECIMAL(12,4) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wireless_alert_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wireless_polling_configurations" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "ip_address" VARCHAR(45),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval_secs" INTEGER NOT NULL DEFAULT 3600,
    "device_type" VARCHAR(20) NOT NULL,
    "link_capacity_bps" BIGINT,
    "clients_provisioned_limit" INTEGER,
    "last_polled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wireless_polling_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_credentials_device_id_key" ON "device_credentials"("device_id");

-- CreateIndex
CREATE INDEX "wireless_snapshots_device_id_collected_at_idx" ON "wireless_snapshots"("device_id", "collected_at" DESC);

-- CreateIndex
CREATE INDEX "wireless_snapshots_collected_at_idx" ON "wireless_snapshots"("collected_at");

-- CreateIndex
CREATE INDEX "wireless_alert_records_device_id_metric_is_active_idx" ON "wireless_alert_records"("device_id", "metric", "is_active");

-- CreateIndex
CREATE INDEX "wireless_alert_records_is_active_triggered_at_idx" ON "wireless_alert_records"("is_active", "triggered_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wireless_polling_configurations_device_id_key" ON "wireless_polling_configurations"("device_id");

-- CreateIndex
CREATE INDEX "wireless_polling_configurations_enabled_idx" ON "wireless_polling_configurations"("enabled");

-- AddForeignKey
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wireless_snapshots" ADD CONSTRAINT "wireless_snapshots_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wireless_alert_records" ADD CONSTRAINT "wireless_alert_records_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wireless_polling_configurations" ADD CONSTRAINT "wireless_polling_configurations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
