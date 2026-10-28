-- CreateTable
CREATE TABLE "router_system_states" (
    "device_id" UUID NOT NULL,
    "identity" VARCHAR(255),
    "model" VARCHAR(100),
    "serial_number" VARCHAR(100),
    "mac_address" VARCHAR(17),
    "board_name" VARCHAR(100),
    "router_os_version" VARCHAR(50),
    "current_firmware" VARCHAR(50),
    "upgrade_firmware" VARCHAR(50),
    "uptime_seconds" INTEGER,
    "cpu_load_percent" SMALLINT,
    "free_memory_bytes" BIGINT,
    "total_memory_bytes" BIGINT,
    "free_hdd_bytes" BIGINT,
    "total_hdd_bytes" BIGINT,
    "voltage" REAL,
    "temperature_c" REAL,
    "read_at" TIMESTAMPTZ,
    "last_error" VARCHAR(500),
    "attempted_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "router_system_states_pkey" PRIMARY KEY ("device_id")
);

-- AddForeignKey
ALTER TABLE "router_system_states" ADD CONSTRAINT "router_system_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
