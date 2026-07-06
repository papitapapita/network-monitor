-- AlterTable
ALTER TABLE "wireless_snapshots" ADD COLUMN     "mac_address" VARCHAR(17),
ADD COLUMN     "device_model" VARCHAR(100),
ADD COLUMN     "ssid" VARCHAR(64);
