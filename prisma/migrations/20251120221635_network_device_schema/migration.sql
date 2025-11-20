-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ROUTER', 'SWITCH', 'ANTENNA', 'OLT', 'ONU', 'OTHER');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NetworkDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE', 'DAMAGED');

-- CreateEnum
CREATE TYPE "DeviceOwner" AS ENUM ('COMPANY', 'CLIENT', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "NetworkDeviceType" AS ENUM ('CORE_ROUTER', 'EDGE_ROUTER', 'DISTRIBUTION_SWITCH', 'ACCESS_SWITCH', 'WIRELESS_ACCESS_POINT', 'FIREWALL', 'LOAD_BALANCER', 'ACCESS_POINT', 'MODEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ConnectivityType" AS ENUM ('ETHERNET', 'FIBER_OPTIC', 'WIRELESS', 'DSL', 'SATELLITE', 'OTHER');

-- CreateEnum
CREATE TYPE "ManagementProtocol" AS ENUM ('SNMP', 'SSH', 'TELNET', 'HTTP', 'HTTPS', 'OTHER');

-- CreateEnum
CREATE TYPE "EnergySourceType" AS ENUM ('SOLAR', 'BATTERY', 'MAINS', 'GENERATOR', 'POE', 'OTHER');

-- CreateEnum
CREATE TYPE "BackupEnergyType" AS ENUM ('UPS', 'BATTERY_BANK', 'SOLAR_PANEL', 'NONE', 'OTHER');

-- CreateEnum
CREATE TYPE "RadioAntennaType" AS ENUM ('ACCESS_POINT', 'STATION');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" TEXT,
    "location" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceModel" (
    "idInt" SERIAL NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "operatingSystem" TEXT,
    "specifications" TEXT,

    CONSTRAINT "DeviceModel_pkey" PRIMARY KEY ("idInt")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observations" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "supplierId" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'INACTIVE',
    "owner" "DeviceOwner" NOT NULL DEFAULT 'COMPANY',
    "serialNumber" TEXT NOT NULL,
    "guaranteeEndDate" TIMESTAMP(3),
    "deviceModelId" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "coordenates" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkDevice" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NetworkDeviceType" NOT NULL,
    "description" TEXT,
    "installDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "connectivityType" "ConnectivityType" NOT NULL,
    "managementProtocol" "ManagementProtocol" NOT NULL,
    "managementPort" INTEGER NOT NULL,
    "enabledRemoteAccess" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" INTEGER NOT NULL,

    CONSTRAINT "NetworkDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadioAntenna" (
    "id" SERIAL NOT NULL,
    "power" DOUBLE PRECISION,
    "antennaGain" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "frequencyRange" TEXT,
    "type" "RadioAntennaType" NOT NULL,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "RadioAntenna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPoint" (
    "id" SERIAL NOT NULL,
    "ssid" TEXT NOT NULL,
    "frequencyChannel" INTEGER,
    "bandwidth" DOUBLE PRECISION,
    "ptpMode" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "radioAntennaId" INTEGER NOT NULL,

    CONSTRAINT "AccessPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rxThroughput" DOUBLE PRECISION NOT NULL,
    "txThroughput" DOUBLE PRECISION NOT NULL,
    "rxSignalStrength" DOUBLE PRECISION,
    "txSignalStrength" DOUBLE PRECISION,
    "latency" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "sourceDeviceId" INTEGER NOT NULL,
    "destinationDeviceId" INTEGER NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSoftware" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "lastUpdateDate" TIMESTAMP(3),
    "backupLink" TEXT,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceSoftware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" TEXT,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceMaintenanceLog" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "performedById" INTEGER NOT NULL,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSecurity" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "SNMPPassword" TEXT,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLogs" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logLevel" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEnergy" (
    "id" SERIAL NOT NULL,
    "sourceType" "EnergySourceType" NOT NULL,
    "powerConsumption" DOUBLE PRECISION NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL,
    "backUpEnergy" "BackupEnergyType" NOT NULL,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceEnergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceMonitoring" (
    "id" SERIAL NOT NULL,
    "uptime" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "status" "NetworkDeviceStatus" NOT NULL,
    "avgLatency" DOUBLE PRECISION NOT NULL,
    "packetsLost" DOUBLE PRECISION NOT NULL,
    "rxThroughput" DOUBLE PRECISION NOT NULL,
    "txThroughput" DOUBLE PRECISION NOT NULL,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMonitoring" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "memoryUsage" DOUBLE PRECISION NOT NULL,
    "diskUsage" DOUBLE PRECISION NOT NULL,
    "networkDeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceMonitoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeviceModelToSupplier" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DeviceModelToSupplier_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Device_locationId_key" ON "Device"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkDevice_ipAddress_key" ON "NetworkDevice"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkDevice_macAddress_key" ON "NetworkDevice"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkDevice_deviceId_key" ON "NetworkDevice"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "RadioAntenna_networkDeviceId_key" ON "RadioAntenna"("networkDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPoint_radioAntennaId_key" ON "AccessPoint"("radioAntennaId");

-- CreateIndex
CREATE UNIQUE INDEX "Link_sourceDeviceId_key" ON "Link"("sourceDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Link_destinationDeviceId_key" ON "Link"("destinationDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSoftware_networkDeviceId_key" ON "DeviceSoftware"("networkDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSecurity_networkDeviceId_key" ON "DeviceSecurity"("networkDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceEnergy_networkDeviceId_key" ON "DeviceEnergy"("networkDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceMonitoring_networkDeviceId_key" ON "DeviceMonitoring"("networkDeviceId");

-- CreateIndex
CREATE INDEX "_DeviceModelToSupplier_B_index" ON "_DeviceModelToSupplier"("B");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel"("idInt") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "_DeviceModelToSupplier" ADD CONSTRAINT "_DeviceModelToSupplier_A_fkey" FOREIGN KEY ("A") REFERENCES "DeviceModel"("idInt") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceModelToSupplier" ADD CONSTRAINT "_DeviceModelToSupplier_B_fkey" FOREIGN KEY ("B") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
