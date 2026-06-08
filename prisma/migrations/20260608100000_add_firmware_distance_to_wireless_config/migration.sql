ALTER TABLE "wireless_polling_configurations"
  ADD COLUMN "target_firmware_version" VARCHAR(50),
  ADD COLUMN "max_link_distance_m" INT;
