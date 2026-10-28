-- AlterTable
ALTER TABLE "router_system_states" ADD COLUMN     "health_issues" VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR(20)[],
ADD COLUMN     "high_cpu_checks" SMALLINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "router_health_thresholds" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "cpu_percent" SMALLINT NOT NULL,
    "min_free_memory_percent" SMALLINT NOT NULL,
    "min_free_disk_percent" SMALLINT NOT NULL,
    "max_temperature_c" SMALLINT NOT NULL,
    "min_voltage" REAL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "router_health_thresholds_pkey" PRIMARY KEY ("id")
);
