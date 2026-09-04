-- Per-device LAN-speed baseline: auto-captured from the first poll that
-- reports a negotiated speed, used by WLS-089 to warn when a port
-- degrades below what it originally negotiated at.
ALTER TABLE "wireless_polling_configurations"
ADD COLUMN "provisioned_lan_speed_mbps" INTEGER;
