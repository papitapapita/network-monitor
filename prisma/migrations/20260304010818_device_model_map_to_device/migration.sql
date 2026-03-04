/*
  Warnings:

  - You are about to drop the `Device` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_device_model_id_fkey";

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_location_id_fkey";

-- DropForeignKey
ALTER TABLE "alert_events" DROP CONSTRAINT "alert_events_device_id_fkey";

-- DropForeignKey
ALTER TABLE "device_states" DROP CONSTRAINT "device_states_device_id_fkey";

-- DropForeignKey
ALTER TABLE "ping_results" DROP CONSTRAINT "ping_results_device_id_fkey";

-- DropForeignKey
ALTER TABLE "polling_configurations" DROP CONSTRAINT "polling_configurations_device_id_fkey";

-- DropTable
DROP TABLE "Device";

-- CreateTable
CREATE TABLE "devices" (
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

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_states" ADD CONSTRAINT "device_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ping_results" ADD CONSTRAINT "ping_results_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polling_configurations" ADD CONSTRAINT "polling_configurations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
