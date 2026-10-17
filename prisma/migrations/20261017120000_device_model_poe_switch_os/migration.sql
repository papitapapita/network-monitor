-- PoE power control reads a switch's ports by the firmware its model runs.
CREATE TYPE "poe_switch_os" AS ENUM ('ROUTEROS', 'SWOS');

ALTER TABLE "device_models" ADD COLUMN "poe_switch_os" "poe_switch_os";
