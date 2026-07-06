-- AlterTable
ALTER TABLE "wireless_snapshots" ADD COLUMN     "capacity_rx_kbps" INTEGER,
ADD COLUMN     "capacity_tx_kbps" INTEGER,
ADD COLUMN     "device_time_epoch" BIGINT,
ADD COLUMN     "remote_ap_device_id" UUID,
ADD COLUMN     "remote_ap_ip" VARCHAR(45);
