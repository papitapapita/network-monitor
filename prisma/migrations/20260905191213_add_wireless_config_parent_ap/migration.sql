-- AlterTable
ALTER TABLE "wireless_polling_configurations" ADD COLUMN     "parent_ap_device_id" UUID;

-- CreateIndex
CREATE INDEX "wireless_polling_configurations_parent_ap_device_id_idx" ON "wireless_polling_configurations"("parent_ap_device_id");

-- AddForeignKey
ALTER TABLE "wireless_polling_configurations" ADD CONSTRAINT "wireless_polling_configurations_parent_ap_device_id_fkey" FOREIGN KEY ("parent_ap_device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
