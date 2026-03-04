-- CreateEnum
CREATE TYPE "device_type" AS ENUM ('ANTENNA', 'OTHER', 'RADIO', 'ROUTER', 'ROUTERBOARD', 'SERVER', 'SWITCH');

-- CreateEnum
CREATE TYPE "vendors" AS ENUM ('TP_LINK', 'MIKROTIK', 'UBIQUITI', 'MIMOSA', 'TENDA', 'OTHER');

-- CreateEnum
CREATE TYPE "location_type" AS ENUM ('TOWER', 'NODE', 'DATACENTER', 'POP', 'WAREHOUSE', 'OFFICE');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('ACTIVE', 'DAMAGED', 'DECOMMISSIONED', 'INVENTORY', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "device_category" AS ENUM ('CORE', 'DISTRIBUTION', 'POE', 'ACCESS_POINT', 'CLIENT_CPE');

-- CreateEnum
CREATE TYPE "device_owner" AS ENUM ('COMPANY', 'CLIENT');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "device_models" (
    "id" UUID NOT NULL,
    "manufacturer" "vendors" NOT NULL,
    "model" VARCHAR(150) NOT NULL,
    "device_type" "device_type" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "location_type" NOT NULL,
    "municipality" VARCHAR(100),
    "neighborhood" VARCHAR(150),
    "address" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "altitude" DECIMAL(7,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "device_model_id" UUID NOT NULL,
    "location_id" UUID,
    "status" "device_status" NOT NULL DEFAULT 'INVENTORY',
    "category" "device_category",
    "owner" "device_owner" NOT NULL DEFAULT 'COMPANY',
    "name" VARCHAR(150) NOT NULL,
    "serial_number" VARCHAR(100),
    "mac_address" VARCHAR(17),
    "ip_address" VARCHAR(45),
    "description" TEXT,
    "installed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "monitoring_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_states" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" TIMESTAMPTZ,
    "last_latency_ms" DECIMAL(8,2),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ping_results" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "is_reachable" BOOLEAN NOT NULL,
    "latency_ms" DECIMAL(8,2),
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ping_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "severity" "alert_severity" NOT NULL DEFAULT 'CRITICAL',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "notified_at" TIMESTAMPTZ,
    "recovery_notified_at" TIMESTAMPTZ,
    "duration_secs" INTEGER,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polling_configurations" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "failures_before_down" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "polling_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_models_manufacturer_model_key" ON "device_models"("manufacturer", "model");

-- CreateIndex
CREATE UNIQUE INDEX "device_states_device_id_key" ON "device_states"("device_id");

-- CreateIndex
CREATE INDEX "ping_results_device_id_checked_at_idx" ON "ping_results"("device_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "ping_results_checked_at_idx" ON "ping_results"("checked_at");

-- CreateIndex
CREATE INDEX "alert_events_device_id_started_at_idx" ON "alert_events"("device_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "alert_events_resolved_at_idx" ON "alert_events"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "polling_configurations_device_id_key" ON "polling_configurations"("device_id");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_states" ADD CONSTRAINT "device_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ping_results" ADD CONSTRAINT "ping_results_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polling_configurations" ADD CONSTRAINT "polling_configurations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
