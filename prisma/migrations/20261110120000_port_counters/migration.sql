-- AlterTable
ALTER TABLE "router_health_thresholds" ADD COLUMN     "flap_link_downs" SMALLINT NOT NULL DEFAULT 3,
ADD COLUMN     "min_sfp_rx_power_dbm" REAL DEFAULT -20;

-- CreateTable
CREATE TABLE "port_counters" (
    "device_id" UUID NOT NULL,
    "port_name" VARCHAR(64) NOT NULL,
    "rx_errors" BIGINT,
    "link_downs" BIGINT,
    "read_at" TIMESTAMPTZ NOT NULL,
    "errors_added" BIGINT,
    "link_downs_added" BIGINT,
    "error_checks" INTEGER NOT NULL DEFAULT 0,
    "quiet_checks" INTEGER NOT NULL DEFAULT 0,
    "issues" VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR(20)[],

    CONSTRAINT "port_counters_pkey" PRIMARY KEY ("device_id","port_name")
);

-- AddForeignKey
ALTER TABLE "port_counters" ADD CONSTRAINT "port_counters_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
