-- Live router traffic reads the RouterOS API with the device's HTTP login.
ALTER TABLE "device_credentials" ADD COLUMN "api_port" INTEGER NOT NULL DEFAULT 8728;
