/*
  Warnings:

  - The primary key for the `AccessPoint` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Device` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceEnergy` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceLogs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceMaintenanceLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceModel` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idInt` on the `DeviceModel` table. All the data in the column will be lost.
  - The primary key for the `DeviceMonitoring` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceSecurity` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeviceSoftware` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Link` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Location` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `NetworkDevice` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PurchaseOrder` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RadioAntenna` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Supplier` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Technician` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_DeviceModelToSupplier` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `DeviceModel` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "AccessPoint" DROP CONSTRAINT "AccessPoint_radioAntennaId_fkey";

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_deviceModelId_fkey";

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_purchaseOrderId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceEnergy" DROP CONSTRAINT "DeviceEnergy_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceLogs" DROP CONSTRAINT "DeviceLogs_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceMaintenanceLog" DROP CONSTRAINT "DeviceMaintenanceLog_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceMaintenanceLog" DROP CONSTRAINT "DeviceMaintenanceLog_performedById_fkey";

-- DropForeignKey
ALTER TABLE "DeviceMonitoring" DROP CONSTRAINT "DeviceMonitoring_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceSecurity" DROP CONSTRAINT "DeviceSecurity_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceSoftware" DROP CONSTRAINT "DeviceSoftware_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "Link" DROP CONSTRAINT "Link_destinationDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "Link" DROP CONSTRAINT "Link_sourceDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "NetworkDevice" DROP CONSTRAINT "NetworkDevice_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "RadioAntenna" DROP CONSTRAINT "RadioAntenna_networkDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "_DeviceModelToSupplier" DROP CONSTRAINT "_DeviceModelToSupplier_A_fkey";

-- DropForeignKey
ALTER TABLE "_DeviceModelToSupplier" DROP CONSTRAINT "_DeviceModelToSupplier_B_fkey";

-- AlterTable
ALTER TABLE "AccessPoint" DROP CONSTRAINT "AccessPoint_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "radioAntennaId" SET DATA TYPE TEXT,
ADD CONSTRAINT "AccessPoint_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AccessPoint_id_seq";

-- AlterTable
ALTER TABLE "Device" DROP CONSTRAINT "Device_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "deviceModelId" SET DATA TYPE TEXT,
ALTER COLUMN "purchaseOrderId" SET DATA TYPE TEXT,
ALTER COLUMN "locationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Device_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Device_id_seq";

-- AlterTable
ALTER TABLE "DeviceEnergy" DROP CONSTRAINT "DeviceEnergy_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceEnergy_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceEnergy_id_seq";

-- AlterTable
ALTER TABLE "DeviceLogs" DROP CONSTRAINT "DeviceLogs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceLogs_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceLogs_id_seq";

-- AlterTable
ALTER TABLE "DeviceMaintenanceLog" DROP CONSTRAINT "DeviceMaintenanceLog_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "performedById" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceMaintenanceLog_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceMaintenanceLog_id_seq";

-- AlterTable
ALTER TABLE "DeviceModel" DROP CONSTRAINT "DeviceModel_pkey",
DROP COLUMN "idInt",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "DeviceModel_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DeviceMonitoring" DROP CONSTRAINT "DeviceMonitoring_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceMonitoring_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceMonitoring_id_seq";

-- AlterTable
ALTER TABLE "DeviceSecurity" DROP CONSTRAINT "DeviceSecurity_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceSecurity_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceSecurity_id_seq";

-- AlterTable
ALTER TABLE "DeviceSoftware" DROP CONSTRAINT "DeviceSoftware_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DeviceSoftware_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DeviceSoftware_id_seq";

-- AlterTable
ALTER TABLE "Link" DROP CONSTRAINT "Link_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sourceDeviceId" SET DATA TYPE TEXT,
ALTER COLUMN "destinationDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Link_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Link_id_seq";

-- AlterTable
ALTER TABLE "Location" DROP CONSTRAINT "Location_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Location_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Location_id_seq";

-- AlterTable
ALTER TABLE "NetworkDevice" DROP CONSTRAINT "NetworkDevice_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "deviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "NetworkDevice_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "NetworkDevice_id_seq";

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "supplierId" SET DATA TYPE TEXT,
ADD CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "PurchaseOrder_id_seq";

-- AlterTable
ALTER TABLE "RadioAntenna" DROP CONSTRAINT "RadioAntenna_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "networkDeviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "RadioAntenna_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RadioAntenna_id_seq";

-- AlterTable
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Supplier_id_seq";

-- AlterTable
ALTER TABLE "Technician" DROP CONSTRAINT "Technician_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Technician_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Technician_id_seq";

-- AlterTable
ALTER TABLE "_DeviceModelToSupplier" DROP CONSTRAINT "_DeviceModelToSupplier_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ALTER COLUMN "B" SET DATA TYPE TEXT,
ADD CONSTRAINT "_DeviceModelToSupplier_AB_pkey" PRIMARY KEY ("A", "B");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkDevice" ADD CONSTRAINT "NetworkDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadioAntenna" ADD CONSTRAINT "RadioAntenna_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPoint" ADD CONSTRAINT "AccessPoint_radioAntennaId_fkey" FOREIGN KEY ("radioAntennaId") REFERENCES "RadioAntenna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_sourceDeviceId_fkey" FOREIGN KEY ("sourceDeviceId") REFERENCES "AccessPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_destinationDeviceId_fkey" FOREIGN KEY ("destinationDeviceId") REFERENCES "RadioAntenna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSoftware" ADD CONSTRAINT "DeviceSoftware_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceMaintenanceLog" ADD CONSTRAINT "DeviceMaintenanceLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceMaintenanceLog" ADD CONSTRAINT "DeviceMaintenanceLog_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSecurity" ADD CONSTRAINT "DeviceSecurity_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLogs" ADD CONSTRAINT "DeviceLogs_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEnergy" ADD CONSTRAINT "DeviceEnergy_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceMonitoring" ADD CONSTRAINT "DeviceMonitoring_networkDeviceId_fkey" FOREIGN KEY ("networkDeviceId") REFERENCES "NetworkDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceModelToSupplier" ADD CONSTRAINT "_DeviceModelToSupplier_A_fkey" FOREIGN KEY ("A") REFERENCES "DeviceModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceModelToSupplier" ADD CONSTRAINT "_DeviceModelToSupplier_B_fkey" FOREIGN KEY ("B") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
