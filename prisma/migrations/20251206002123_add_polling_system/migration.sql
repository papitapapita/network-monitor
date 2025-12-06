-- CreateEnum
CREATE TYPE "PollingStatus" AS ENUM ('SUCCESS', 'PARTIAL_SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "PollingConfiguration" (
    "id" TEXT NOT NULL,
    "networkDeviceId" TEXT NOT NULL,
    "intervalSeconds" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pingCount" INTEGER NOT NULL DEFAULT 4,
    "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "lastScheduledAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollingConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingResult" (
    "id" TEXT NOT NULL,
    "networkDeviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PollingStatus" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "deviceStatus" "NetworkDeviceStatus" NOT NULL,
    "errorMessage" TEXT,
    "responseTimes" DOUBLE PRECISION[],
    "averageResponseTime" DOUBLE PRECISION,
    "minResponseTime" DOUBLE PRECISION,
    "maxResponseTime" DOUBLE PRECISION,
    "jitter" DOUBLE PRECISION,
    "packetsSent" INTEGER,
    "packetsReceived" INTEGER,
    "packetLoss" DOUBLE PRECISION,
    "ttl" INTEGER,
    "responseTimeMs" DOUBLE PRECISION,
    "uptime" INTEGER,
    "temperature" DOUBLE PRECISION,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "interfaceStats" JSONB,
    "bandwidth" JSONB,
    "errors" JSONB,
    "discards" JSONB,

    CONSTRAINT "PollingResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PollingConfiguration_networkDeviceId_key" ON "PollingConfiguration"("networkDeviceId");

-- CreateIndex
CREATE INDEX "PollingConfiguration_networkDeviceId_idx" ON "PollingConfiguration"("networkDeviceId");

-- CreateIndex
CREATE INDEX "PollingConfiguration_nextScheduledAt_idx" ON "PollingConfiguration"("nextScheduledAt");

-- CreateIndex
CREATE INDEX "PollingConfiguration_enabled_nextScheduledAt_idx" ON "PollingConfiguration"("enabled", "nextScheduledAt");

-- CreateIndex
CREATE INDEX "PollingResult_networkDeviceId_timestamp_idx" ON "PollingResult"("networkDeviceId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "PollingResult_timestamp_idx" ON "PollingResult"("timestamp");

-- CreateIndex
CREATE INDEX "PollingResult_status_idx" ON "PollingResult"("status");

-- CreateIndex
CREATE INDEX "PollingResult_networkDeviceId_status_timestamp_idx" ON "PollingResult"("networkDeviceId", "status", "timestamp");

-- AddForeignKey
ALTER TABLE "PollingConfiguration" ADD CONSTRAINT "PollingConfiguration_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingResult" ADD CONSTRAINT "PollingResult_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================================
-- TimescaleDB Configuration
-- ===================================

-- Enable TimescaleDB extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert PollingResult table to TimescaleDB hypertable
-- Partitioned by timestamp for efficient time-series queries
SELECT create_hypertable(
  'PollingResult',
  'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Create continuous aggregate for hourly statistics
-- This pre-computes hourly averages for faster dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS polling_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  "networkDeviceId",
  time_bucket('1 hour', "timestamp") AS hour,
  COUNT(*) AS total_polls,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') AS successful_polls,
  COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_polls,
  AVG("averageResponseTime") AS avg_response_time,
  MIN("minResponseTime") AS min_response_time,
  MAX("maxResponseTime") AS max_response_time,
  AVG("jitter") AS avg_jitter,
  AVG("packetLoss") AS avg_packet_loss
FROM "PollingResult"
GROUP BY "networkDeviceId", hour
WITH NO DATA;

-- Create refresh policy for continuous aggregate
-- Refreshes every hour for data from last 7 days
SELECT add_continuous_aggregate_policy(
  'polling_hourly_stats',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Create compression policy to compress chunks older than 7 days
-- This saves storage space while keeping data queryable
SELECT add_compression_policy(
  'PollingResult',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Create retention policy to drop data older than 90 days (optional)
-- Uncomment if you want automatic data cleanup
-- SELECT add_retention_policy(
--   'PollingResult',
--   INTERVAL '90 days',
--   if_not_exists => TRUE
-- );
