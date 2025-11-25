/*
  Warnings:

  - The values [ANTENNA,ONU,OTHER] on the enum `DeviceType` will be removed. If these variants are still used in the database, this will fail.
  - The values [DEGRADED] on the enum `NetworkDeviceStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `operatingSystem` column on the `DeviceModel` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `backUpEnergy` on the `DeviceEnergy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `manufacturer` on the `DeviceModel` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `NetworkDevice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `RadioAntenna` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RouterType" AS ENUM ('CORE_ROUTER', 'EDGE_ROUTER', 'VIRTUAL_ROUTER', 'WIRELESS_ROUTER');

-- CreateEnum
CREATE TYPE "SwitchType" AS ENUM ('UNMANAGED_SWITCH', 'MANAGED_SWITCH', 'LAYER2_SWITCH', 'LAYER3_SWITCH', 'POE_SWITCH', 'CORE_SWITCH', 'DISTRIBUTION_SWITCH', 'ACCESS_SWITCH');

-- CreateEnum
CREATE TYPE "RadioType" AS ENUM ('ACCESS_POINT', 'PTP_RADIO', 'PTMP_RADIO', 'SECTOR_ANTENNA', 'BACKHAUL_RADIO', 'MIMO_RADIO', 'STATION');

-- CreateEnum
CREATE TYPE "SecurityDeviceType" AS ENUM ('FIREWALL', 'NEXT_GENERATION_FIREWALL', 'UTM', 'IDS', 'IPS', 'VPN', 'NAC', 'AUTHENTICATION_SERVER');

-- CreateEnum
CREATE TYPE "ServerType" AS ENUM ('APPLICATION_SERVER', 'DATABASE_SERVER', 'PROXY_SERVER', 'DHCP_SERVER', 'DNS_SERVER', 'LOAD_BALANCER', 'CDN_NODE', 'SYSLOG_SERVER');

-- CreateEnum
CREATE TYPE "MonitoringHardwareType" AS ENUM ('NETWORK_MONITORING_PROBE', 'SNMP_PROBE', 'OOB_MANAGEMENT_DEVICE', 'KVM', 'ENVIRONMENTAL_SENSOR', 'REMOTE_PDU');

-- CreateEnum
CREATE TYPE "PowerSystemType" AS ENUM ('UPS', 'PDU', 'RECTIFIER', 'INVERTER', 'POE_INJECTOR', 'SOLAR_CHARGE_CONTROLLER', 'BATTERY_BANK');

-- CreateEnum
CREATE TYPE "PhysicalComponentsType" AS ENUM ('PATCH_PANEL', 'ODF', 'FDF', 'NETWORK_RACK', 'CABINET', 'GROUNDING_SYSTEM', 'LIGHTNING_ARRESTOR', 'SURGE_PROTECTOR', 'SPLICE_BOX', 'FIBER_PATCH_CORD', 'PIGTAIL', 'ETHERNET_CABLE_REEL');

-- CreateEnum
CREATE TYPE "ISPDevicesType" AS ENUM ('OLT', 'BRAS', 'PPPOE_SERVER', 'CGNAT', 'AAA_SERVER', 'BANDWITH_MANAGER', 'TRAFFIC_SHAPER', 'TOWER_CONTROLLER');

-- CreateEnum
CREATE TYPE "NetworkDeviceRole" AS ENUM ('ROUTING', 'SWITCHING', 'WIRELESS_ACCESS', 'WIRELESS_CONTROLLER', 'WIRELESS_BRIDGE', 'RADIO_LINK', 'BACKHAUL', 'FIREWALL', 'IDS', 'IPS', 'UTM', 'VPN', 'NAC', 'AUTHENTICATION', 'APPLICATION_HOSTING', 'DATABASE_HOSTING', 'PROXY', 'DHCP', 'DNS', 'LOAD_BALANCING', 'CDN', 'LOGGING', 'MONITORING', 'SNMP', 'OOB_MANAGEMENT', 'KVM_ACCESS', 'ENVIRONMENT_MONITORING', 'POWER_MANAGEMENT');

-- CreateEnum
CREATE TYPE "Vendors" AS ENUM ('MIKROTIK', 'UBIQUITI', 'MIMOSA', 'CISCO', 'ARUBA', 'ARISTA', 'CAMBIUM', 'JUNIPER', 'HUAWEI', 'HPE', 'EXTREME_NETWORKS', 'RADWIN', 'CERAGON', 'TP_LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "OperatingSystems" AS ENUM ('IOS', 'IOS_XE', 'IOS_XR', 'NX_OS', 'JUNOS', 'EOS', 'VRP', 'ARUBAOS', 'COMWARE', 'XOS', 'EXOS', 'ROUTEROS', 'SWITCHOS', 'EDGEOS', 'UNIFI_OS', 'AIROS', 'UFIBER_OS', 'CNMAESTRO_OS', 'EPMP_OS', 'MIMOSAOS', 'RADWIN_OS', 'FIBEAIR_OS', 'PHAROS_OS', 'OMADA_OS', 'FORTIOS', 'PAN_OS', 'SOPHOS_OS', 'GAIA_OS', 'SONICOS', 'FIREWARE_OS', 'PFSENSE_OS', 'OPNSENSE_OS');

-- AlterEnum
ALTER TYPE "DeviceStatus" ADD VALUE 'DEGRADED';

-- AlterEnum
BEGIN;
CREATE TYPE "DeviceType_new" AS ENUM ('ROUTER', 'SWITCH', 'RADIO', 'FIREWALL', 'SERVER', 'MODEM', 'ONT', 'OLT', 'WIRELESS', 'SECURITY', 'EDGE');
ALTER TABLE "DeviceModel" ALTER COLUMN "type" TYPE "DeviceType_new" USING ("type"::text::"DeviceType_new");
ALTER TYPE "DeviceType" RENAME TO "DeviceType_old";
ALTER TYPE "DeviceType_new" RENAME TO "DeviceType";
DROP TYPE "public"."DeviceType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "NetworkDeviceStatus_new" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');
ALTER TABLE "DeviceMonitoring" ALTER COLUMN "status" TYPE "NetworkDeviceStatus_new" USING ("status"::text::"NetworkDeviceStatus_new");
ALTER TYPE "NetworkDeviceStatus" RENAME TO "NetworkDeviceStatus_old";
ALTER TYPE "NetworkDeviceStatus_new" RENAME TO "NetworkDeviceStatus";
DROP TYPE "public"."NetworkDeviceStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "DeviceEnergy" DROP COLUMN "backUpEnergy",
ADD COLUMN     "backUpEnergy" "EnergySourceType" NOT NULL;

-- AlterTable
ALTER TABLE "DeviceModel" DROP COLUMN "manufacturer",
ADD COLUMN     "manufacturer" "Vendors" NOT NULL,
DROP COLUMN "operatingSystem",
ADD COLUMN     "operatingSystem" "OperatingSystems";

-- AlterTable
ALTER TABLE "NetworkDevice" DROP COLUMN "type",
ADD COLUMN     "type" "NetworkDeviceRole" NOT NULL;

-- AlterTable
ALTER TABLE "RadioAntenna" DROP COLUMN "type",
ADD COLUMN     "type" "RadioType" NOT NULL;

-- DropEnum
DROP TYPE "BackupEnergyType";

-- DropEnum
DROP TYPE "NetworkDeviceType";

-- DropEnum
DROP TYPE "RadioAntennaType";
